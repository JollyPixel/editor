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
import {
  ADMIN_ROLE,
  type Account
} from "./account/Account.ts";
import { AccountEntity } from "./account/AccountEntity.ts";
import type { Username } from "./account/Username.ts";
import { AccountChangeRefusedError } from "./account/errors/AccountChangeRefusedError.ts";
import { UsernameTakenError } from "./account/errors/UsernameTakenError.ts";
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
import { MasterPassword } from "./registration/MasterPassword.ts";
import { Membership } from "./realm/Membership.ts";
import type { PasswordDigest } from "./session/PasswordDigest.ts";
import { agentTokenSubject } from "./agent/AgentToken.ts";
import type { AccountsDatabase } from "./store/AccountsDatabase.ts";

// CONSTANTS
const kDefaultMaxConcurrentHashes = 2;

export interface Credentials {
  username: Username;
  password: PasswordDigest;
}

export interface AccountDirectoryOptions {
  database: AccountsDatabase;
  throttle?: AccountsThrottleOptions;
  maxConcurrentHashes?: number;
  masterPassword?: string;
}

export type AccountDirectoryEventMap = {
  changed: () => void;
  revoked: (subject: string) => void;
  profile: (account: Account) => void;
};

export class AccountDirectory extends Emitter<AccountDirectoryEventMap> {
  readonly database: AccountsDatabase;

  #throttle: AccountsThrottle;
  #hashes: Mutex;
  #masterPassword: MasterPassword | null;
  #realms = new Set<string>();
  #dummyHash: Promise<PasswordHash> | null = null;

  constructor(
    options: AccountDirectoryOptions
  ) {
    super();

    this.database = options.database;
    this.#throttle = new AccountsThrottle(options.throttle);
    this.#hashes = new Mutex({
      concurrency: options.maxConcurrentHashes ?? kDefaultMaxConcurrentHashes
    });
    this.#masterPassword = options.masterPassword === undefined ?
      null :
      new MasterPassword(options.masterPassword);
  }

  get claimed(): boolean {
    return this.database.accounts.size > 0;
  }

  openRealm(
    realmId: string
  ): void {
    if (this.#realms.has(realmId)) {
      throw new Error(`the realm "${realmId}" is already open`);
    }
    this.#realms.add(realmId);
  }

  closeRealm(
    realmId: string
  ): void {
    this.#realms.delete(realmId);
  }

  async admitRegistration(
    masterPassword: string | undefined,
    address: string
  ): Promise<void> {
    await this.#throttle.reserveRegistration(address);
    if (!this.claimed) {
      this.#masterPassword?.assertGiven(masterPassword);
    }
  }

  hash(
    password: PasswordDigest
  ): Promise<PasswordHash> {
    return this.#hashing(
      () => hashPassword(password.value)
    );
  }

  insert(
    username: Username,
    hash: PasswordHash
  ): AccountEntity {
    if (this.database.accounts.named(username) !== null) {
      throw new UsernameTakenError(username.value);
    }
    const account = this.claimed ?
      AccountEntity.register(username) :
      AccountEntity.claim(username);
    this.database.accounts.insert(account, username, hash);

    return account;
  }

  async login(
    credentials: Credentials,
    address: string
  ): Promise<AccountEntity> {
    const { username, password } = credentials;

    await this.#throttle.reserveLogin(username, address);
    const stored = this.database.accounts.credentials(username);
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

    return stored.account;
  }

  account(
    id: string
  ): Account | null {
    const account = this.database.accounts.byId(id);

    return account === null ? null : this.toAccount(account);
  }

  transferOwnership(
    actorId: string,
    username: Username
  ): AccountEntity {
    const owner = this.database.transaction(() => {
      const actor = this.#actor(actorId);
      actor.assertOwner();
      const target = this.database.accounts.named(username);
      if (target === null) {
        throw new AccountChangeRefusedError(
          `no account is named "${username.value}"`
        );
      }
      target.assertNotOwner();
      const realms = new Set([
        ...this.database.memberships.realmIds(),
        ...this.#realms
      ]);
      for (const realmId of realms) {
        this.database.memberships.save(
          Membership.active(realmId, actor.id, ADMIN_ROLE)
        );
      }
      const transferred = target.withOwnership(true);
      this.database.accounts.save(transferred);

      return transferred;
    });
    this.emit("changed");
    this.revoke(owner.id);
    for (const tokenId of this.database.agentTokens.liveIdsOwnedBy(owner.id)) {
      this.revoke(agentTokenSubject(tokenId));
    }

    return owner;
  }

  async replaceAvatar(
    accountId: string,
    image: Uint8Array
  ): Promise<Account> {
    const avatar = await AvatarImage.encode(image);
    const account = this.database.transaction(() => {
      const changed = this.#actor(accountId).withAvatar(avatar.hash);
      this.database.avatars.replace(accountId, avatar);

      return changed;
    });
    const replaced = this.toAccount(account);
    this.emit("changed");
    this.emit("profile", replaced);

    return replaced;
  }

  avatar(
    accountId: string
  ): StoredAvatar | null {
    return this.database.avatars.find(accountId);
  }

  revoke(
    subject: string
  ): void {
    this.emit("revoked", subject);
  }

  toAccount(
    account: AccountEntity
  ): Account {
    return {
      id: account.id,
      username: account.username,
      owner: account.owner,
      avatar: account.avatarHash === null ?
        undefined :
        avatarPath(account.id, account.avatarHash)
    };
  }

  #actor(
    id: string
  ): AccountEntity {
    const account = this.database.accounts.byId(id);
    if (account === null) {
      throw new AccountChangeRefusedError(`no account has the id "${id}"`);
    }

    return account;
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
