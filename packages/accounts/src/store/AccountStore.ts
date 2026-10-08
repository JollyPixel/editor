// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  DatabaseSync,
  SQLInputValue
} from "node:sqlite";

// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import {
  ADMIN_ROLE,
  type Account
} from "../account/Account.ts";
import type { Username } from "../account/Username.ts";
import { AccountChangeRefusedError } from "./errors/AccountChangeRefusedError.ts";
import { UsernameTakenError } from "./errors/UsernameTakenError.ts";
import { SQL_SCHEMA } from "./schema.ts";
import {
  digestSessionToken,
  mintSessionToken
} from "./sessionToken.ts";

// CONSTANTS
export const IN_MEMORY_LOCATION = ":memory:";
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const kAccountColumns = "id, username, role";

export interface AccountStoreOptions {
  /**
   * Lifetime of a session token, in milliseconds.
   * @default DEFAULT_SESSION_TTL_MS
   */
  sessionTtlMs?: number;
}

export interface AccountCredentials {
  account: Account;
  hash: PasswordHash;
}

interface AccountRow {
  id: string;
  username: string;
  role: string;
}

interface CredentialsRow extends AccountRow {
  digest: Uint8Array;
  salt: Uint8Array;
}

interface CountRow {
  count: number;
}

export class AccountStore implements Disposable {
  static async open(
    location: string = IN_MEMORY_LOCATION,
    options: AccountStoreOptions = {}
  ): Promise<AccountStore> {
    const { DatabaseSync } = await import("node:sqlite");
    if (location !== IN_MEMORY_LOCATION) {
      await fs.mkdir(
        path.dirname(location),
        { recursive: true }
      );
    }

    const db = new DatabaseSync(location);
    if (location !== IN_MEMORY_LOCATION) {
      db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }

    return new AccountStore(db, options);
  }

  readonly sessionTtlMs: number;

  #db: DatabaseSync;

  constructor(
    db: DatabaseSync,
    options: AccountStoreOptions = {}
  ) {
    this.#db = db;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.#db.exec("PRAGMA foreign_keys = ON;");
    this.#db.exec(SQL_SCHEMA);
  }

  get size(): number {
    return this.#count("SELECT COUNT(*) AS count FROM users");
  }

  register(
    username: Username,
    hash: PasswordHash,
    defaultRole: string
  ): Account {
    return this.#transaction(() => {
      if (this.credentials(username) !== null) {
        throw new UsernameTakenError(username.value);
      }

      const account: Account = {
        id: randomUUID(),
        username: username.value,
        role: this.size === 0 ? ADMIN_ROLE : defaultRole
      };
      this.#run(
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
    const row = this.#get<CredentialsRow>(
      `SELECT ${kAccountColumns}, digest, salt FROM users WHERE username_key = ?`,
      username.key
    );
    if (row === undefined) {
      return null;
    }

    return {
      account: toAccount(row),
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
    this.#run(
      "DELETE FROM sessions WHERE expires_at <= ?",
      now
    );
    this.#run(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      digestSessionToken(token),
      accountId,
      now + this.sessionTtlMs
    );

    return token;
  }

  accountForToken(
    token: string
  ): Account | null {
    const row = this.#get<AccountRow>(
      `SELECT users.id, users.username, users.role
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      digestSessionToken(token),
      Date.now()
    );

    return row === undefined ? null : toAccount(row);
  }

  accountById(
    id: string
  ): Account | null {
    const row = this.#get<AccountRow>(
      `SELECT ${kAccountColumns} FROM users WHERE id = ?`,
      id
    );

    return row === undefined ? null : toAccount(row);
  }

  closeSession(
    token: string
  ): void {
    this.#run(
      "DELETE FROM sessions WHERE token_hash = ?",
      digestSessionToken(token)
    );
  }

  assignRole(
    username: Username,
    role: string
  ): Account {
    return this.#transaction(() => {
      const account = this.#existing(username);
      if (role !== ADMIN_ROLE) {
        this.#assertNotLastAdmin(account);
      }
      this.#run(
        "UPDATE users SET role = ? WHERE id = ?",
        role,
        account.id
      );

      return {
        ...account,
        role
      };
    });
  }

  remove(
    username: Username
  ): Account {
    return this.#transaction(() => {
      const account = this.#existing(username);
      this.#assertNotLastAdmin(account);
      this.#run(
        "DELETE FROM users WHERE id = ?",
        account.id
      );

      return account;
    });
  }

  * [Symbol.iterator](): IterableIterator<Account> {
    const rows = this.#db
      .prepare(`SELECT ${kAccountColumns} FROM users ORDER BY created_at, rowid`)
      .all() as unknown as AccountRow[];
    for (const row of rows) {
      yield toAccount(row);
    }
  }

  close(): void {
    if (this.#db.isOpen) {
      this.#db.close();
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  #existing(
    username: Username
  ): Account {
    const credentials = this.credentials(username);
    if (credentials === null) {
      throw new AccountChangeRefusedError(
        `no account is named "${username.value}"`
      );
    }

    return credentials.account;
  }

  #assertNotLastAdmin(
    account: Account
  ): void {
    if (account.role !== ADMIN_ROLE) {
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

  #transaction<T>(
    body: () => T
  ): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = body();
      this.#db.exec("COMMIT");

      return result;
    }
    catch (error) {
      this.#db.exec("ROLLBACK");

      throw error;
    }
  }

  #count(
    sql: string,
    ...parameters: SQLInputValue[]
  ): number {
    return this.#get<CountRow>(sql, ...parameters)?.count ?? 0;
  }

  #get<TRow>(
    sql: string,
    ...parameters: SQLInputValue[]
  ): TRow | undefined {
    return this.#db.prepare(sql).get(...parameters) as TRow | undefined;
  }

  #run(
    sql: string,
    ...parameters: SQLInputValue[]
  ): void {
    this.#db.prepare(sql).run(...parameters);
  }
}

function toAccount(
  row: AccountRow
): Account {
  return {
    id: row.id,
    username: row.username,
    role: row.role
  };
}
