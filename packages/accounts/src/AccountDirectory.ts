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
import type {
  AccessRequest,
  Account
} from "./account/Account.ts";
import { AccountEntity } from "./account/AccountEntity.ts";
import type { Username } from "./account/Username.ts";
import { AccountChangeRefusedError } from "./account/errors/AccountChangeRefusedError.ts";
import { UsernameTakenError } from "./account/errors/UsernameTakenError.ts";
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
import { avatarPath } from "./http/routes.ts";
import {
  MasterPassword,
  type MasterPasswordOptions
} from "./registration/MasterPassword.ts";
import { AccessRequestsFullError } from "./registration/errors/AccessRequestsFullError.ts";
import { AccountPendingError } from "./registration/errors/AccountPendingError.ts";
import type { RegisterOptions } from "./registration/RegisterOptions.ts";
import type { RegistrationResult } from "./registration/RegistrationResult.ts";
import type { PasswordDigest } from "./session/PasswordDigest.ts";
import type { AccountsDatabase } from "./store/AccountsDatabase.ts";

// CONSTANTS
const kDefaultMaxConcurrentHashes = 2;
const kDefaultMaxAccessRequests = 20;

export interface Credentials {
  username: Username;
  password: PasswordDigest;
}

export interface Registration extends Credentials {
  options: RegisterOptions;
}

export interface AccountDirectoryOptions {
  database: AccountsDatabase;
  roles: AccountRoles;
  throttle?: AccountsThrottleOptions;
  maxConcurrentHashes?: number;
  masterPassword?: MasterPasswordOptions;
  maxAccessRequests?: number;
}

export type AccountDirectoryEventMap = {
  changed: () => void;
  revoked: (accountId: string) => void;
  profile: (account: Account) => void;
};

export class AccountDirectory extends Emitter<AccountDirectoryEventMap>
  implements Iterable<Account> {
  readonly roles: AccountRoles;

  #database: AccountsDatabase;
  #throttle: AccountsThrottle;
  #hashes: Mutex;
  #masterPassword: MasterPassword | null;
  #maxAccessRequests: number;
  #dummyHash: Promise<PasswordHash> | null = null;

  constructor(
    options: AccountDirectoryOptions
  ) {
    super();

    this.#database = options.database;
    this.roles = options.roles;
    this.#throttle = new AccountsThrottle(options.throttle);
    this.#hashes = new Mutex({
      concurrency: options.maxConcurrentHashes ?? kDefaultMaxConcurrentHashes
    });
    this.#masterPassword = options.masterPassword === undefined ?
      null :
      new MasterPassword(options.masterPassword);
    this.#maxAccessRequests = options.maxAccessRequests ??
      kDefaultMaxAccessRequests;
  }

  async register(
    registration: Registration,
    address: string
  ): Promise<RegistrationResult> {
    const { username, password, options } = registration;

    await this.#throttle.reserveRegistration(address);
    const status = this.#masterPassword?.admit(
      options.masterPassword,
      this.#database.accounts.size === 0
    ) ?? "active";
    const hash = await this.#hashing(
      () => hashPassword(password.value)
    );
    if (status === "pending") {
      this.#requestAccess(username, hash);
      this.emit("changed");

      return { status };
    }
    const account = this.#register(username, hash);
    this.emit("changed");

    return {
      status,
      account: this.#account(account)
    };
  }

  async login(
    credentials: Credentials,
    address: string
  ): Promise<Account> {
    const { username, password } = credentials;

    await this.#throttle.reserveLogin(username, address);
    const stored = this.#database.accounts.credentials(username);
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
    if (stored.account.pending) {
      throw new AccountPendingError();
    }

    return this.#account(stored.account);
  }

  account(
    id: string
  ): Account | null {
    const account = this.#database.accounts.byId(id);

    return account === null ? null : this.#account(account);
  }

  isAdmin(
    accountId: string
  ): boolean {
    return this.#database.accounts.byId(accountId)?.isAdmin === true;
  }

  assignRole(
    actorId: string,
    username: Username,
    role: string
  ): Account {
    const account = this.#database.transaction(() => {
      this.#actor(actorId).assertAdmin();
      this.#assertDeclared(role);
      const target = this.#existingAccount(username);
      target.assertNotOwner();
      const changed = target.withRole(role);
      this.#database.accounts.save(changed);

      return changed;
    });
    this.emit("changed");
    this.revoke(account.id);

    return this.#account(account);
  }

  approve(
    actorId: string,
    username: Username,
    role: string
  ): Account {
    const account = this.#database.transaction(() => {
      this.#actor(actorId).assertAdmin();
      this.#assertDeclared(role);
      const approved = this.#existingRequest(username).approved(role);
      this.#database.accounts.save(approved);

      return approved;
    });
    this.emit("changed");

    return this.#account(account);
  }

  deny(
    actorId: string,
    username: Username
  ): void {
    this.#database.transaction(() => {
      this.#actor(actorId).assertAdmin();
      this.#database.accounts.delete(
        this.#existingRequest(username).id
      );
    });
    this.emit("changed");
  }

  remove(
    actorId: string,
    username: Username
  ): Account {
    const account = this.#database.transaction(() => {
      this.#actor(actorId).assertAdmin();
      const removed = this.#existingAccount(username);
      removed.assertNotOwner();
      this.#database.accounts.delete(removed.id);

      return removed;
    });
    this.emit("changed");
    this.revoke(account.id);

    return this.#account(account);
  }

  transferOwnership(
    actorId: string,
    username: Username
  ): Account {
    const owner = this.#database.transaction(() => {
      this.#actor(actorId).assertOwner();
      const target = this.#existingAccount(username);
      target.assertNotOwner();
      const transferred = target.promotedToOwner();
      this.#database.accounts.save(transferred);

      return transferred;
    });
    this.emit("changed");
    this.revoke(owner.id);

    return this.#account(owner);
  }

  async replaceAvatar(
    accountId: string,
    image: Uint8Array
  ): Promise<Account> {
    const avatar = await AvatarImage.encode(image);
    const account = this.#database.transaction(() => {
      const changed = this.#actor(accountId).withAvatar(avatar.hash);
      this.#database.avatars.replace(accountId, avatar);

      return changed;
    });
    const replaced = this.#account(account);
    this.emit("changed");
    this.emit("profile", replaced);

    return replaced;
  }

  avatar(
    accountId: string
  ): StoredAvatar | null {
    return this.#database.avatars.find(accountId);
  }

  revoke(
    accountId: string
  ): void {
    this.emit("revoked", accountId);
  }

  * [Symbol.iterator](): IterableIterator<Account> {
    for (const account of this.#database.accounts) {
      if (!account.pending) {
        yield this.#account(account);
      }
    }
  }

  * requests(): IterableIterator<AccessRequest> {
    for (const account of this.#database.accounts) {
      if (account.pending) {
        yield {
          id: account.id,
          username: account.username
        };
      }
    }
  }

  #register(
    username: Username,
    hash: PasswordHash
  ): AccountEntity {
    return this.#database.transaction(() => {
      this.#assertAvailable(username);
      const account = this.#database.accounts.size === 0 ?
        AccountEntity.claim(username) :
        AccountEntity.register(username, this.roles.defaultRole);
      this.#database.accounts.insert(account, username, hash);

      return account;
    });
  }

  #requestAccess(
    username: Username,
    hash: PasswordHash
  ): void {
    this.#database.transaction(() => {
      if (this.#database.accounts.pendingSize >= this.#maxAccessRequests) {
        throw new AccessRequestsFullError(this.#maxAccessRequests);
      }
      this.#assertAvailable(username);
      this.#database.accounts.insert(
        AccountEntity.request(username, this.roles.defaultRole),
        username,
        hash
      );
    });
  }

  #assertAvailable(
    username: Username
  ): void {
    if (this.#database.accounts.named(username) !== null) {
      throw new UsernameTakenError(username.value);
    }
  }

  #actor(
    id: string
  ): AccountEntity {
    const account = this.#database.accounts.byId(id);
    if (account === null) {
      throw new AccountChangeRefusedError(`no account has the id "${id}"`);
    }

    return account;
  }

  #existingAccount(
    username: Username
  ): AccountEntity {
    const account = this.#database.accounts.named(username);
    if (account === null || account.pending) {
      throw new AccountChangeRefusedError(
        `no account is named "${username.value}"`
      );
    }

    return account;
  }

  #existingRequest(
    username: Username
  ): AccountEntity {
    const account = this.#database.accounts.named(username);
    if (account === null || !account.pending) {
      throw new AccountChangeRefusedError(
        `no access request is named "${username.value}"`
      );
    }

    return account;
  }

  #assertDeclared(
    role: string
  ): void {
    if (!this.roles.has(role)) {
      throw new AccountChangeRefusedError(`"${role}" is not a role`);
    }
  }

  #account(
    account: AccountEntity
  ): Account {
    return {
      id: account.id,
      username: account.username,
      role: this.roles.effective(account.role),
      owner: account.owner,
      avatar: account.avatarHash === null ?
        undefined :
        avatarPath(account.id, account.avatarHash)
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
