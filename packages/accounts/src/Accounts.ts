// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "@jolly-pixel/network";
import {
  hashPassword,
  verifyPassword,
  type PasswordHash
} from "@jolly-pixel/network/node";

// Import Internal Dependencies
import type { Account } from "./account/Account.ts";
import type { Username } from "./account/Username.ts";
import type { AccountRoles } from "./auth/AccountRoles.ts";
import {
  AccountStore,
  type AccountStoreOptions
} from "./store/AccountStore.ts";
import { SessionCookie } from "./session/SessionCookie.ts";
import type { PasswordDigest } from "./session/PasswordDigest.ts";
import {
  createAccountsHandler,
  type AccountsHandler
} from "./http/createAccountsHandler.ts";
import type { LoginThrottleOptions } from "./http/LoginLimiter.ts";
import { AccountsExtension } from "./room/AccountsExtension.ts";
import { AccountChangeRefusedError } from "./store/errors/AccountChangeRefusedError.ts";

export interface AccountsOptions {
  store: AccountStore;
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
  throttle?: LoginThrottleOptions;
}

export interface AccountsOpenOptions
  extends Omit<AccountsOptions, "store">, AccountStoreOptions {
  /**
   * @default IN_MEMORY_LOCATION
   */
  location?: string;
}

export interface AccountSession {
  token: string;
  account: Account;
}

export type AccountsEventMap = {
  changed: () => void;
};

export class Accounts extends Emitter<AccountsEventMap>
  implements AuthenticationProvider, Iterable<Account>, Disposable {
  static async open(
    options: AccountsOpenOptions
  ): Promise<Accounts> {
    const {
      location,
      sessionTtlMs,
      ...accountsOptions
    } = options;

    return new Accounts({
      ...accountsOptions,
      store: await AccountStore.open(location, { sessionTtlMs })
    });
  }

  readonly roles: AccountRoles;
  readonly cookie: SessionCookie;
  readonly sessionTtlMs: number;
  readonly handler: AccountsHandler;
  readonly extension: AccountsExtension;

  #store: AccountStore;
  #dummyHash: Promise<PasswordHash> | null = null;

  constructor(
    options: AccountsOptions
  ) {
    super();
    this.#store = options.store;
    this.roles = options.roles;
    this.cookie = options.cookie ?? new SessionCookie();
    this.sessionTtlMs = options.store.sessionTtlMs;
    this.handler = createAccountsHandler(this, options);
    this.extension = new AccountsExtension(this);
  }

  async register(
    username: Username,
    password: PasswordDigest
  ): Promise<AccountSession> {
    const account = this.#store.register(
      username,
      await hashPassword(password.value),
      this.roles.defaultRole
    );
    this.emit("changed");

    return this.#open(account);
  }

  async login(
    username: Username,
    password: PasswordDigest
  ): Promise<AccountSession | null> {
    const credentials = this.#store.credentials(username);
    const valid = await verifyPassword(
      password.value,
      credentials?.hash ?? await this.#dummy()
    );

    return credentials === null || !valid ?
      null :
      this.#open(credentials.account);
  }

  logout(
    token: string
  ): void {
    this.#store.closeSession(token);
  }

  accountForToken(
    token: string
  ): Account | null {
    const account = this.#store.accountForToken(token);

    return account === null ? null : this.#effective(account);
  }

  accountById(
    id: string
  ): Account | null {
    const account = this.#store.accountById(id);

    return account === null ? null : this.#effective(account);
  }

  assignRole(
    username: Username,
    role: string
  ): Account {
    if (!this.roles.has(role)) {
      throw new AccountChangeRefusedError(`"${role}" is not a role`);
    }
    const account = this.#store.assignRole(username, role);
    this.emit("changed");

    return account;
  }

  remove(
    username: Username
  ): Account {
    const account = this.#store.remove(username);
    this.emit("changed");

    return account;
  }

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null {
    const token = this.cookie.read(request.headers);
    const account = token === null ? null : this.accountForToken(token);
    if (account === null) {
      return null;
    }

    return {
      subject: account.id,
      role: account.role,
      profile: {
        username: account.username,
        peerId: account.id
      }
    };
  }

  * [Symbol.iterator](): IterableIterator<Account> {
    for (const account of this.#store) {
      yield this.#effective(account);
    }
  }

  [Symbol.dispose](): void {
    this.extension.dispose();
    this.#store.close();
  }

  #open(
    account: Account
  ): AccountSession {
    return {
      token: this.#store.openSession(account.id),
      account: this.#effective(account)
    };
  }

  #effective(
    account: Account
  ): Account {
    return {
      ...account,
      role: this.roles.effective(account.role)
    };
  }

  #dummy(): Promise<PasswordHash> {
    this.#dummyHash ??= hashPassword(randomUUID());

    return this.#dummyHash;
  }
}
