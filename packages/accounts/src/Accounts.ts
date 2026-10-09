// Import Third-party Dependencies
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { AccountDirectory } from "./AccountDirectory.ts";
import type { AccountRoles } from "./auth/AccountRoles.ts";
import type { AccountsThrottleOptions } from "./auth/AccountsThrottle.ts";
import { AccountStore } from "./store/AccountStore.ts";
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
  store: AccountStore;
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

export interface AccountsOpenOptions extends Omit<AccountsOptions, "store"> {
  roles: AccountRoles;
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
      roles,
      location,
      ...accountsOptions
    } = options;

    return new Accounts({
      ...accountsOptions,
      store: await AccountStore.open(roles, location)
    });
  }

  readonly roles: AccountRoles;
  readonly cookie: SessionCookie;
  readonly handler: AccountsHandler;
  readonly extension: AccountsExtension;

  #store: AccountStore;
  #directory: AccountDirectory;
  #sessions: CookieSessions;

  constructor(
    options: AccountsOptions
  ) {
    const prefix = options.path ?? ACCOUNTS_URL_PATH;
    this.#store = options.store;
    this.#directory = new AccountDirectory({
      store: options.store,
      avatarUrl: (accountId, hash) => avatarPath(prefix, accountId, hash),
      throttle: options.throttle,
      maxConcurrentHashes: options.maxConcurrentHashes,
      masterPassword: options.masterPassword,
      maxAccessRequests: options.maxAccessRequests
    });
    this.#sessions = new CookieSessions(
      options.store,
      this.#directory,
      options.cookie ?? new SessionCookie()
    );
    this.roles = options.store.roles;
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
      profile: {
        username: account.username,
        peerId: account.id,
        avatar: account.avatar ?? null
      }
    };
  }

  watchRevocations(
    listener: (accountId: string) => void
  ): () => void {
    return this.#directory.watchRevocations(listener);
  }

  [Symbol.dispose](): void {
    this.extension.dispose();
    this.#store.close();
  }
}
