// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import { Mutex } from "@openally/mutex";
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
import {
  ACCOUNTS_URL_PATH,
  type Account
} from "./account/Account.ts";
import type { Username } from "./account/Username.ts";
import type { AccountRoles } from "./auth/AccountRoles.ts";
import {
  AccountStore,
  type AccountStoreOptions
} from "./store/AccountStore.ts";
import type { StoredAccount } from "./store/StoredAccount.ts";
import { SessionCookie } from "./session/SessionCookie.ts";
import type { PasswordDigest } from "./session/PasswordDigest.ts";
import {
  createAccountsHandler,
  type AccountsHandler
} from "./http/createAccountsHandler.ts";
import { AccountsEndpoint } from "./http/AccountsEndpoint.ts";
import {
  AccountsThrottle,
  type AccountsThrottleOptions
} from "./http/AccountsThrottle.ts";
import { TrustedProxies } from "./http/TrustedProxies.ts";
import { AccountsExtension } from "./room/AccountsExtension.ts";
import { AccountChangeRefusedError } from "./store/errors/AccountChangeRefusedError.ts";
import {
  AvatarImage,
  type StoredAvatar
} from "./avatar/AvatarImage.ts";

// CONSTANTS
const kDefaultMaxConcurrentHashes = 2;

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
  readonly path: string;
  readonly sessionTtlMs: number;
  readonly handler: AccountsHandler;
  readonly extension: AccountsExtension;

  #store: AccountStore;
  #hashes: Mutex;
  #revocations = new Set<(accountId: string) => void>();
  #dummyHash: Promise<PasswordHash> | null = null;

  constructor(
    options: AccountsOptions
  ) {
    super();
    this.#store = options.store;
    this.#hashes = new Mutex({
      concurrency: options.maxConcurrentHashes ?? kDefaultMaxConcurrentHashes
    });
    this.roles = options.roles;
    this.cookie = options.cookie ?? new SessionCookie();
    this.path = options.path ?? ACCOUNTS_URL_PATH;
    this.sessionTtlMs = options.store.sessionTtlMs;
    this.handler = createAccountsHandler(
      this.path,
      new AccountsEndpoint(
        this,
        new AccountsThrottle(options.throttle),
        new TrustedProxies(options.proxyHops)
      )
    );
    this.extension = new AccountsExtension(this);
  }

  async register(
    username: Username,
    password: PasswordDigest
  ): Promise<AccountSession> {
    const account = this.#store.register(
      username,
      await this.#hashing(() => hashPassword(password.value)),
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
    const hash = credentials?.hash ?? await this.#dummy();
    const valid = await this.#hashing(
      () => verifyPassword(password.value, hash)
    );

    return credentials === null || !valid ?
      null :
      this.#open(credentials.account);
  }

  logout(
    token: string
  ): void {
    const accountId = this.#store.closeSession(token);
    if (accountId !== null) {
      this.#revoke(accountId);
    }
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
    this.#revoke(account.id);

    return this.#effective(account);
  }

  remove(
    username: Username
  ): Account {
    const account = this.#store.remove(username);
    this.emit("changed");
    this.#revoke(account.id);

    return this.#effective(account);
  }

  async replaceAvatar(
    accountId: string,
    image: Uint8Array
  ): Promise<Account> {
    const avatar = await AvatarImage.encode(image);
    const account = this.#store.replaceAvatar(accountId, avatar);
    this.emit("changed");

    return this.#effective(account);
  }

  avatar(
    accountId: string
  ): StoredAvatar | null {
    return this.#store.avatar(accountId);
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
        peerId: account.id,
        avatar: account.avatar ?? null
      }
    };
  }

  watchRevocations(
    listener: (accountId: string) => void
  ): () => void {
    this.#revocations.add(listener);

    return () => {
      this.#revocations.delete(listener);
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
    account: StoredAccount
  ): AccountSession {
    return {
      token: this.#store.openSession(account.id),
      account: this.#effective(account)
    };
  }

  #effective(
    account: StoredAccount
  ): Account {
    return {
      id: account.id,
      username: account.username,
      role: this.roles.effective(account.role),
      avatar: account.avatarHash === null ?
        undefined :
        `${this.path}${account.id}/avatar?v=${account.avatarHash}`
    };
  }

  #revoke(
    accountId: string
  ): void {
    for (const listener of this.#revocations) {
      listener(accountId);
    }
  }

  #dummy(): Promise<PasswordHash> {
    this.#dummyHash ??= this.#hashing(() => hashPassword(randomUUID()));

    return this.#dummyHash;
  }

  async #hashing<TResult>(
    task: () => Promise<TResult>
  ): Promise<TResult> {
    using _ = await this.#hashes.acquire();

    return await task();
  }
}
