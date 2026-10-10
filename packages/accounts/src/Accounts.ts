// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// Import Third-party Dependencies
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity,
  PeerMetadata
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { Account } from "./account/Account.ts";
import { Username } from "./account/Username.ts";
import {
  AccountDirectory,
  type Credentials
} from "./AccountDirectory.ts";
import type { AccountRoles } from "./auth/AccountRoles.ts";
import type { AccountsThrottleOptions } from "./auth/AccountsThrottle.ts";
import type { StoredAvatar } from "./avatar/AvatarImage.ts";
import type {
  CredentialsBody,
  RegistrationBody
} from "./http/routes.schema.ts";
import { AccountsDatabase } from "./store/AccountsDatabase.ts";
import { PasswordDigest } from "./session/PasswordDigest.ts";
import { SessionCookie } from "./session/SessionCookie.ts";
import { CookieSessions } from "./session/CookieSessions.ts";
import { AccountsExtension } from "./room/AccountsExtension.ts";
import type { MasterPasswordOptions } from "./registration/MasterPassword.ts";

export interface AccountsOptions {
  database: AccountsDatabase;
  roles: AccountRoles;
  /**
   * @default new SessionCookie()
   */
  cookie?: SessionCookie;
  throttle?: AccountsThrottleOptions;
  /**
   * Password hashes and checks running at once.
   * @default 2
   */
  maxConcurrentHashes?: number;
  /**
   * Secret the first registration must give. With `accessRequests`, a later
   * registration without it creates an access request. Without it,
   * registration is open.
   */
  masterPassword?: MasterPasswordOptions;
  /**
   * Access requests allowed to wait at once.
   * @default 20
   */
  maxAccessRequests?: number;
}

export interface AccountsOpenOptions extends Omit<AccountsOptions, "database"> {
  /**
   * @default IN_MEMORY_LOCATION
   */
  location?: string;
}

export interface Requester {
  /**
   * Client address the throttle counts attempts against.
   */
  address: string;
  /**
   * Whether the request came over TLS, which makes the cookie `Secure`.
   */
  secure: boolean;
  /**
   * Request headers the session cookie is read from.
   */
  headers: IncomingHttpHeaders;
}

export interface SignIn {
  account: Account;
  /**
   * `Set-Cookie` header value of the new session.
   */
  cookie: string;
}

export type SignInRegistration =
  | (SignIn & {
    status: "active";
  })
  | {
    status: "pending";
  };

export class Accounts implements AuthenticationProvider, Disposable {
  static async open(
    options: AccountsOpenOptions
  ): Promise<Accounts> {
    const {
      location,
      ...accountsOptions
    } = options;

    return new Accounts({
      ...accountsOptions,
      database: await AccountsDatabase.open(location)
    });
  }

  readonly roles: AccountRoles;
  readonly cookie: SessionCookie;
  readonly extension: AccountsExtension;

  #database: AccountsDatabase;
  #directory: AccountDirectory;
  #sessions: CookieSessions;

  constructor(
    options: AccountsOptions
  ) {
    this.#database = options.database;
    this.roles = options.roles;
    this.#directory = new AccountDirectory({
      database: options.database,
      roles: options.roles,
      throttle: options.throttle,
      maxConcurrentHashes: options.maxConcurrentHashes,
      masterPassword: options.masterPassword,
      maxAccessRequests: options.maxAccessRequests
    });
    this.#sessions = new CookieSessions(
      options.database.sessions,
      this.#directory,
      options.cookie ?? new SessionCookie()
    );
    this.cookie = this.#sessions.cookie;
    this.extension = new AccountsExtension(this.#directory);
  }

  async register(
    body: RegistrationBody,
    requester: Requester
  ): Promise<SignInRegistration> {
    const registration = await this.#directory.register(
      {
        ...parseCredentials(body),
        options: {
          masterPassword: body.masterPassword
        }
      },
      requester.address
    );
    if (registration.status === "pending") {
      return registration;
    }

    return {
      status: "active",
      ...this.#signIn(registration.account, requester)
    };
  }

  async login(
    body: CredentialsBody,
    requester: Requester
  ): Promise<SignIn> {
    const account = await this.#directory.login(
      parseCredentials(body),
      requester.address
    );

    return this.#signIn(account, requester);
  }

  signOut(
    requester: Requester
  ): string {
    return this.#sessions.close(requester.headers, requester.secure);
  }

  signedIn(
    headers: IncomingHttpHeaders
  ): Account | null {
    return this.#sessions.account(headers);
  }

  replaceAvatar(
    accountId: string,
    image: Uint8Array
  ): Promise<Account> {
    return this.#directory.replaceAvatar(accountId, image);
  }

  avatar(
    accountId: string
  ): StoredAvatar | null {
    return this.#directory.avatar(accountId);
  }

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null {
    const account = this.signedIn(request.headers);
    if (account === null) {
      return null;
    }

    return {
      subject: account.id,
      role: account.role,
      profile: toPeerProfile(account)
    };
  }

  watchRevocations(
    listener: (accountId: string) => void
  ): () => void {
    return this.#directory.subscribe("revoked", listener);
  }

  watchProfiles(
    listener: (accountId: string, profile: PeerMetadata) => void
  ): () => void {
    return this.#directory.subscribe(
      "profile",
      (account) => listener(account.id, toPeerProfile(account))
    );
  }

  [Symbol.dispose](): void {
    this.extension.dispose();
    this.#database.close();
  }

  #signIn(
    account: Account,
    requester: Requester
  ): SignIn {
    return {
      account,
      cookie: this.#sessions.open(account, requester.secure)
    };
  }
}

function parseCredentials(
  body: CredentialsBody
): Credentials {
  return {
    username: Username.parse(body.username),
    password: PasswordDigest.parse(body.password)
  };
}

function toPeerProfile(
  account: Account
): PeerMetadata {
  return {
    username: account.username,
    peerId: account.id,
    avatar: account.avatar ?? null
  };
}
