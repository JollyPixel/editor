// Import Third-party Dependencies
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity,
  PeerMetadata
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { Account } from "./account/Account.ts";
import { AccountDirectory } from "./AccountDirectory.ts";
import type { AccountRoles } from "./auth/AccountRoles.ts";
import type { AccountsThrottleOptions } from "./auth/AccountsThrottle.ts";
import { AccountsDatabase } from "./store/AccountsDatabase.ts";
import { SessionCookie } from "./session/SessionCookie.ts";
import { CookieSessions } from "./session/CookieSessions.ts";
import { AccountsApi } from "./http/accounts/AccountsApi.ts";
import { accountsFailure } from "./http/accounts/accountsFailure.ts";
import {
  ACCOUNTS_URL_PATH,
  avatarPath
} from "./http/accounts/routes.ts";
import {
  HttpRouter,
  type HttpHandler
} from "./http/core/HttpRouter.ts";
import { TrustedProxies } from "./http/core/TrustedProxies.ts";
import { AccountsExtension } from "./room/AccountsExtension.ts";
import type { MasterPasswordOptions } from "./registration/MasterPassword.ts";

export type AccountsHandler = HttpHandler;

export interface AccountsOptions {
  database: AccountsDatabase;
  roles: AccountRoles;
  /**
   * @default new SessionCookie()
   */
  cookie?: SessionCookie;
  /**
   * URL prefix of the HTTP routes, with a trailing slash.
   * @default ACCOUNTS_URL_PATH
   */
  path?: string;
  throttle?: AccountsThrottleOptions;
  /**
   * Reverse proxies in front of the server. Each one must append to
   * `X-Forwarded-For` and `X-Forwarded-Proto`.
   * @default 0
   */
  proxyHops?: number;
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
  readonly handler: AccountsHandler;
  readonly extension: AccountsExtension;

  #database: AccountsDatabase;
  #directory: AccountDirectory;
  #sessions: CookieSessions;

  constructor(
    options: AccountsOptions
  ) {
    const prefix = options.path ?? ACCOUNTS_URL_PATH;
    this.#database = options.database;
    this.roles = options.roles;
    this.#directory = new AccountDirectory({
      database: options.database,
      roles: options.roles,
      avatarUrl: (accountId, hash) => avatarPath(prefix, accountId, hash),
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
    this.handler = new HttpRouter({
      prefix,
      routes: new AccountsApi(this.#directory, this.#sessions),
      proxies: new TrustedProxies(options.proxyHops),
      failure: accountsFailure
    }).handler;
    this.extension = new AccountsExtension(this.#directory);
  }

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null {
    const account = this.#sessions.account(request.headers);
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
