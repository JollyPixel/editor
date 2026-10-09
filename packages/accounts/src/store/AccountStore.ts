// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";
import type { Username } from "../account/Username.ts";
import type { AccountRoles } from "../auth/AccountRoles.ts";
import type { StoredAvatar } from "../avatar/AvatarImage.ts";
import type { SessionToken } from "../session/SessionToken.ts";
import { AccountChangeRefusedError } from "./errors/AccountChangeRefusedError.ts";
import { UsernameTakenError } from "./errors/UsernameTakenError.ts";
import { SQL_SCHEMA } from "./schema.ts";
import {
  IN_MEMORY_LOCATION,
  SqliteDatabase
} from "./SqliteDatabase.ts";
import {
  StoredAccount,
  type StoredAccountFields
} from "./StoredAccount.ts";

// CONSTANTS
export { IN_MEMORY_LOCATION } from "./SqliteDatabase.ts";
const kAccountColumns = "users.id, users.username, users.role, avatars.hash AS avatarHash";
const kAccountTables = "users LEFT JOIN avatars ON avatars.user_id = users.id";

export interface AccountCredentials {
  account: StoredAccount;
  hash: PasswordHash;
}

interface CredentialsRow extends StoredAccountFields {
  digest: Uint8Array;
  salt: Uint8Array;
}

interface SessionRow {
  user_id: string;
}

interface CountRow {
  count: number;
}

export class AccountStore implements Disposable {
  static async open(
    roles: AccountRoles,
    location: string = IN_MEMORY_LOCATION
  ): Promise<AccountStore> {
    return new AccountStore(
      await SqliteDatabase.open(location),
      roles
    );
  }

  readonly roles: AccountRoles;

  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase,
    roles: AccountRoles
  ) {
    this.#db = db;
    this.roles = roles;
    this.#db.exec(SQL_SCHEMA);
  }

  get size(): number {
    return this.#count("SELECT COUNT(*) AS count FROM users");
  }

  get unclaimed(): boolean {
    return this.size === 0;
  }

  register(
    username: Username,
    hash: PasswordHash
  ): StoredAccount {
    return this.#db.transaction(() => {
      if (this.credentials(username) !== null) {
        throw new UsernameTakenError(username.value);
      }

      const account = new StoredAccount({
        id: randomUUID(),
        username: username.value,
        role: this.unclaimed ? ADMIN_ROLE : this.roles.defaultRole,
        avatarHash: null
      });
      this.#db.run(
        `INSERT INTO users (id, username, username_key, digest, salt, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        account.id,
        account.username,
        username.key,
        hash.digest,
        hash.salt,
        account.role,
        Date.now()
      );

      return account;
    });
  }

  credentials(
    username: Username
  ): AccountCredentials | null {
    const row = this.#db.get<CredentialsRow>(
      `SELECT ${kAccountColumns}, users.digest, users.salt
       FROM ${kAccountTables} WHERE users.username_key = ?`,
      username.key
    );
    if (row === undefined) {
      return null;
    }

    return {
      account: this.#account(row),
      hash: {
        digest: Buffer.from(row.digest),
        salt: Buffer.from(row.salt)
      }
    };
  }

  openSession(
    token: SessionToken,
    accountId: string,
    expiresAt: number
  ): void {
    this.#db.run(
      "DELETE FROM sessions WHERE expires_at <= ?",
      Date.now()
    );
    this.#db.run(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      token.digest,
      accountId,
      expiresAt
    );
  }

  sessionOwner(
    token: SessionToken
  ): string | null {
    const row = this.#db.get<SessionRow>(
      "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
      token.digest,
      Date.now()
    );

    return row?.user_id ?? null;
  }

  closeSession(
    token: SessionToken
  ): string | null {
    const row = this.#db.get<SessionRow>(
      "DELETE FROM sessions WHERE token_hash = ? RETURNING user_id",
      token.digest
    );

    return row?.user_id ?? null;
  }

  accountById(
    id: string
  ): StoredAccount | null {
    const row = this.#db.get<StoredAccountFields>(
      `SELECT ${kAccountColumns} FROM ${kAccountTables} WHERE users.id = ?`,
      id
    );

    return row === undefined ? null : this.#account(row);
  }

  assignRole(
    actorId: string,
    username: Username,
    role: string
  ): StoredAccount {
    return this.#db.transaction(() => {
      this.#assertAdmin(actorId);
      if (!this.roles.has(role)) {
        throw new AccountChangeRefusedError(`"${role}" is not a role`);
      }
      const account = this.#existing(username);
      if (role !== ADMIN_ROLE) {
        this.#assertNotLastAdmin(account);
      }

      this.#db.run(
        "UPDATE users SET role = ? WHERE id = ?",
        role,
        account.id
      );

      return account.withRole(role);
    });
  }

  remove(
    actorId: string,
    username: Username
  ): StoredAccount {
    return this.#db.transaction(() => {
      this.#assertAdmin(actorId);
      const account = this.#existing(username);
      this.#assertNotLastAdmin(account);
      this.#db.run(
        "DELETE FROM users WHERE id = ?",
        account.id
      );

      return account;
    });
  }

  replaceAvatar(
    accountId: string,
    avatar: StoredAvatar
  ): StoredAccount {
    return this.#db.transaction(() => {
      const account = this.accountById(accountId);
      if (account === null) {
        throw new AccountChangeRefusedError(`no account has the id "${accountId}"`);
      }

      this.#db.run(
        `INSERT INTO avatars (user_id, hash, bytes) VALUES (?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET hash = excluded.hash, bytes = excluded.bytes`,
        accountId,
        avatar.hash,
        avatar.bytes
      );

      return account.withAvatar(avatar.hash);
    });
  }

  avatar(
    accountId: string
  ): StoredAvatar | null {
    const row = this.#db.get<StoredAvatar>(
      "SELECT hash, bytes FROM avatars WHERE user_id = ?",
      accountId
    );

    return row === undefined ?
      null :
      {
        hash: row.hash,
        bytes: row.bytes
      };
  }

  * [Symbol.iterator](): IterableIterator<StoredAccount> {
    const rows = this.#db.all<StoredAccountFields>(
      `SELECT ${kAccountColumns} FROM ${kAccountTables} ORDER BY users.created_at, users.rowid`
    );
    for (const row of rows) {
      yield this.#account(row);
    }
  }

  close(): void {
    this.#db.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }

  #account(
    fields: StoredAccountFields
  ): StoredAccount {
    return new StoredAccount({
      id: fields.id,
      username: fields.username,
      role: this.roles.effective(fields.role),
      avatarHash: fields.avatarHash
    });
  }

  #existing(
    username: Username
  ): StoredAccount {
    const credentials = this.credentials(username);
    if (credentials === null) {
      throw new AccountChangeRefusedError(
        `no account is named "${username.value}"`
      );
    }

    return credentials.account;
  }

  #assertAdmin(
    actorId: string
  ): void {
    if (this.accountById(actorId)?.isAdmin !== true) {
      throw new AccountChangeRefusedError("only an admin manages accounts");
    }
  }

  #assertNotLastAdmin(
    account: StoredAccount
  ): void {
    if (!account.isAdmin) {
      return;
    }

    const admins = this.#count(
      "SELECT COUNT(*) AS count FROM users WHERE role = ?",
      ADMIN_ROLE
    );
    if (admins <= 1) {
      throw new AccountChangeRefusedError(
        `"${account.username}" is the last admin`
      );
    }
  }

  #count(
    sql: string,
    ...parameters: SQLInputValue[]
  ): number {
    const countRow = this.#db.get<CountRow>(
      sql,
      ...parameters
    );

    return countRow?.count ?? 0;
  }
}
