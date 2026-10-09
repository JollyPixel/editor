// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import { Mutex } from "@openally/mutex";
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
  AccountsThrottle,
  type AccountsThrottleOptions
} from "./auth/AccountsThrottle.ts";
import { InvalidCredentialsError } from "./auth/errors/InvalidCredentialsError.ts";
import {
  AvatarImage,
  type StoredAvatar
} from "./avatar/AvatarImage.ts";
import {
  MasterPassword,
  type MasterPasswordOptions
} from "./registration/MasterPassword.ts";
import type { RegisterOptions } from "./registration/RegisterOptions.ts";
import type { PasswordDigest } from "./session/PasswordDigest.ts";
import type { AccountStore } from "./store/AccountStore.ts";
import type { StoredAccount } from "./store/StoredAccount.ts";

// CONSTANTS
const kDefaultMaxConcurrentHashes = 2;

export interface Credentials {
  username: Username;
  password: PasswordDigest;
}

export interface Registration extends Credentials {
  options: RegisterOptions;
}

export type AvatarUrl = (
  accountId: string,
  hash: string
) => string;

export interface AccountDirectoryOptions {
  store: AccountStore;
  avatarUrl: AvatarUrl;
  throttle?: AccountsThrottleOptions;
  maxConcurrentHashes?: number;
  masterPassword?: MasterPasswordOptions;
}

export type AccountDirectoryEventMap = {
  changed: () => void;
};

export class AccountDirectory extends Emitter<AccountDirectoryEventMap>
  implements Iterable<Account> {
  #store: AccountStore;
  #avatarUrl: AvatarUrl;
  #throttle: AccountsThrottle;
  #hashes: Mutex;
  #masterPassword: MasterPassword | null;
  #revocations = new Set<(accountId: string) => void>();
  #dummyHash: Promise<PasswordHash> | null = null;

  constructor(
    options: AccountDirectoryOptions
  ) {
    super();

    this.#store = options.store;
    this.#avatarUrl = options.avatarUrl;
    this.#throttle = new AccountsThrottle(options.throttle);
    this.#hashes = new Mutex({
      concurrency: options.maxConcurrentHashes ?? kDefaultMaxConcurrentHashes
    });
    this.#masterPassword = options.masterPassword === undefined ?
      null :
      new MasterPassword(options.masterPassword);
  }

  get roles(): AccountRoles {
    return this.#store.roles;
  }

  async register(
    registration: Registration,
    address: string
  ): Promise<Account> {
    const { username, password, options } = registration;

    await this.#throttle.reserveRegistration(address);
    this.#masterPassword?.admit(
      options.masterPassword,
      this.#store.unclaimed
    );
    const account = this.#store.register(
      username,
      await this.#hashing(
        () => hashPassword(password.value)
      )
    );
    this.emit("changed");

    return this.#account(account);
  }

  async login(
    credentials: Credentials,
    address: string
  ): Promise<Account> {
    const { username, password } = credentials;

    await this.#throttle.reserveLogin(username, address);
    const stored = this.#store.credentials(username);
    const hash = stored?.hash ?? await this.#dummy();
    const valid = await this.#hashing(
      () => verifyPassword(password.value, hash)
    );
    if (stored === null || !valid) {
      throw new InvalidCredentialsError();
    }
    await this.#throttle.forgiveLogin(
      username,
      address
    );

    return this.#account(stored.account);
  }

  account(
    id: string
  ): Account | null {
    const account = this.#store.accountById(id);

    return account === null ? null : this.#account(account);
  }

  assignRole(
    actorId: string,
    username: Username,
    role: string
  ): Account {
    const account = this.#store.assignRole(
      actorId,
      username,
      role
    );
    this.emit("changed");
    this.revoke(account.id);

    return this.#account(account);
  }

  remove(
    actorId: string,
    username: Username
  ): Account {
    const account = this.#store.remove(
      actorId,
      username
    );
    this.emit("changed");
    this.revoke(account.id);

    return this.#account(account);
  }

  async replaceAvatar(
    accountId: string,
    image: Uint8Array
  ): Promise<Account> {
    const avatar = await AvatarImage.encode(image);
    const account = this.#store.replaceAvatar(
      accountId,
      avatar
    );
    this.emit("changed");

    return this.#account(account);
  }

  avatar(
    accountId: string
  ): StoredAvatar | null {
    return this.#store.avatar(accountId);
  }

  revoke(
    accountId: string
  ): void {
    for (const listener of this.#revocations) {
      listener(accountId);
    }
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
      yield this.#account(account);
    }
  }

  #account(
    account: StoredAccount
  ): Account {
    return {
      id: account.id,
      username: account.username,
      role: account.role,
      avatar: account.avatarHash === null ?
        undefined :
        this.#avatarUrl(account.id, account.avatarHash)
    };
  }

  #dummy(): Promise<PasswordHash> {
    this.#dummyHash ??= this.#hashing(
      () => hashPassword(randomUUID())
    );

    return this.#dummyHash;
  }

  async #hashing<TResult>(
    task: () => Promise<TResult>
  ): Promise<TResult> {
    using _ = await this.#hashes.acquire();

    return await task();
  }
}
