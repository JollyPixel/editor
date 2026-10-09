// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";
import type { Username } from "../account/Username.ts";
import type { StoredAvatar } from "../avatar/AvatarImage.ts";
import { AccountChangeRefusedError } from "./errors/AccountChangeRefusedError.ts";
import { UsernameTakenError } from "./errors/UsernameTakenError.ts";
import { SQL_SCHEMA } from "./schema.ts";
import {
  IN_MEMORY_LOCATION,
  SqliteDatabase
} from "./SqliteDatabase.ts";
import {
  digestSessionToken,
  mintSessionToken
} from "./sessionToken.ts";
import {
  StoredAccount,
  type StoredAccountFields
} from "./StoredAccount.ts";

// CONSTANTS
export { IN_MEMORY_LOCATION } from "./SqliteDatabase.ts";
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const kAccountColumns = "users.id, users.username, users.role, avatars.hash AS avatarHash";
const kAccountTables = "users LEFT JOIN avatars ON avatars.user_id = users.id";

export interface AccountStoreOptions {
  /**
   * Lifetime of a session token, in milliseconds.
   * @default DEFAULT_SESSION_TTL_MS
   */
  sessionTtlMs?: number;
}

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
    location: string = IN_MEMORY_LOCATION,
    options: AccountStoreOptions = {}
  ): Promise<AccountStore> {
    return new AccountStore(
      await SqliteDatabase.open(location),
      options
    );
  }

  readonly sessionTtlMs: number;

  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase,
    options: AccountStoreOptions = {}
  ) {
    this.#db = db;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
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
    hash: PasswordHash,
    defaultRole: string
  ): StoredAccount {
    return this.#db.transaction(() => {
      if (this.credentials(username) !== null) {
        throw new UsernameTakenError(username.value);
      }

      const account = new StoredAccount({
        id: randomUUID(),
        username: username.value,
        role: this.unclaimed ? ADMIN_ROLE : defaultRole,
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
      account: new StoredAccount(row),
      hash: {
        digest: Buffer.from(row.digest),
        salt: Buffer.from(row.salt)
      }
    };
  }

  openSession(
    accountId: string
  ): string {
    const now = Date.now();
    const token = mintSessionToken();
    this.#db.run(
      "DELETE FROM sessions WHERE expires_at <= ?",
      now
    );
    this.#db.run(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      digestSessionToken(token),
      accountId,
      now + this.sessionTtlMs
    );

    return token;
  }

  accountForToken(
    token: string
  ): StoredAccount | null {
    const row = this.#db.get<StoredAccountFields>(
      `SELECT ${kAccountColumns}
       FROM ${kAccountTables} JOIN sessions ON sessions.user_id = users.id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      digestSessionToken(token),
      Date.now()
    );

    return row === undefined
      ? null
      : new StoredAccount(row);
  }

  accountById(
    id: string
  ): StoredAccount | null {
    const row = this.#db.get<StoredAccountFields>(
      `SELECT ${kAccountColumns} FROM ${kAccountTables} WHERE users.id = ?`,
      id
    );

    return row === undefined ? null : new StoredAccount(row);
  }

  closeSession(
    token: string
  ): string | null {
    const row = this.#db.get<SessionRow>(
      "DELETE FROM sessions WHERE token_hash = ? RETURNING user_id",
      digestSessionToken(token)
    );

    return row?.user_id ?? null;
  }

  assignRole(
    username: Username,
    role: string
  ): StoredAccount {
    return this.#db.transaction(() => {
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
    username: Username
  ): StoredAccount {
    return this.#db.transaction(() => {
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
      yield new StoredAccount(row);
    }
  }

  close(): void {
    this.#db.close();
  }

  [Symbol.dispose](): void {
    this.close();
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
