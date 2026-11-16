// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// Import Internal Dependencies
import type { Account } from "./account/Account.ts";
import { AccountDirectory } from "./AccountDirectory.ts";
import {
  AccountsRealm,
  type AccountsRealmOptions
} from "./AccountsRealm.ts";
import type { AccountsThrottleOptions } from "./auth/AccountsThrottle.ts";
import { parseCredentials } from "./auth/parseCredentials.ts";
import type { StoredAvatar } from "./avatar/AvatarImage.ts";
import type { CredentialsBody } from "./http/routes.schema.ts";
import { MemberDirectory } from "./realm/MemberDirectory.ts";
import { AccountsDatabase } from "./store/AccountsDatabase.ts";
import type { PreferenceOverrides } from "./store/PreferenceRepository.ts";
import { SessionCookie } from "./session/SessionCookie.ts";
import { CookieSessions } from "./session/CookieSessions.ts";

export interface AccountsOptions {
  database: AccountsDatabase;
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
   * Secret the first registration must give. Without it, the first account
   * to register owns the server.
   */
  masterPassword?: string;
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

export class Accounts implements Disposable {
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

  readonly cookie: SessionCookie;

  #database: AccountsDatabase;
  #directory: AccountDirectory;
  #sessions: CookieSessions;
  #realms = new Set<AccountsRealm>();

  constructor(
    options: AccountsOptions
  ) {
    this.#database = options.database;
    this.#directory = new AccountDirectory({
      database: options.database,
      throttle: options.throttle,
      maxConcurrentHashes: options.maxConcurrentHashes,
      masterPassword: options.masterPassword
    });
    this.#sessions = new CookieSessions(
      options.database.sessions,
      this.#directory,
      options.cookie ?? new SessionCookie()
    );
    this.cookie = this.#sessions.cookie;
  }

  realm(
    id: string,
    options: AccountsRealmOptions
  ): AccountsRealm {
    const realm = new AccountsRealm({
      members: new MemberDirectory({
        ...options,
        realmId: id,
        accounts: this.#directory
      }),
      sessions: this.#sessions,
      database: this.#database,
      closed: () => this.#realms.delete(realm)
    });
    this.#realms.add(realm);

    return realm;
  }

  account(
    accountId: string
  ): Account | null {
    return this.#directory.account(accountId);
  }

  async login(
    body: CredentialsBody,
    requester: Requester
  ): Promise<SignIn> {
    const account = await this.#directory.login(
      parseCredentials(body),
      requester.address
    );

    return {
      account: this.#directory.toAccount(account),
      cookie: this.#sessions.open(account.id, requester.secure)
    };
  }

  signOut(
    requester: Requester
  ): string {
    return this.#sessions.close(requester.headers, requester.secure);
  }

  signedIn(
    headers: IncomingHttpHeaders
  ): Account | null {
    const accountId = this.#sessions.accountId(headers);

    return accountId === null ? null : this.#directory.account(accountId);
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

  preferences(
    accountId: string
  ): Map<string, PreferenceOverrides> {
    return this.#database.preferences.findAll(accountId);
  }

  replacePreferences(
    accountId: string,
    scope: string,
    overrides: PreferenceOverrides
  ): void {
    this.#database.preferences.replace(accountId, scope, overrides);
  }

  [Symbol.dispose](): void {
    for (const realm of this.#realms) {
      realm[Symbol.dispose]();
    }
    this.#database.close();
  }
}
