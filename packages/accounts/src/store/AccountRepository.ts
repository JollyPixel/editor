// Import Third-party Dependencies
import type { PasswordHash } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import {
  AccountEntity,
  type AccountEntityFields
} from "../account/AccountEntity.ts";
import type { Username } from "../account/Username.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

// CONSTANTS
const kAccountColumns = [
  "users.id",
  "users.username",
  "users.role",
  "users.status",
  "avatars.hash AS avatarHash",
  "ownership.user_id IS NOT NULL AS owner"
].join(", ");
const kAccountTables = [
  "users",
  "LEFT JOIN avatars ON avatars.user_id = users.id",
  "LEFT JOIN ownership ON ownership.user_id = users.id"
].join(" ");

export interface AccountCredentials {
  account: AccountEntity;
  hash: PasswordHash;
}

interface AccountRow extends Omit<AccountEntityFields, "owner"> {
  owner: number;
}

interface CredentialsRow extends AccountRow {
  digest: Uint8Array;
  salt: Uint8Array;
}

interface CountRow {
  count: number;
}

export class AccountRepository implements Iterable<AccountEntity> {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  get size(): number {
    return this.#db.get<CountRow>(
      "SELECT COUNT(*) AS count FROM users"
    )?.count ?? 0;
  }

  get pendingSize(): number {
    return this.#db.get<CountRow>(
      "SELECT COUNT(*) AS count FROM users WHERE status = 'pending'"
    )?.count ?? 0;
  }

  byId(
    id: string
  ): AccountEntity | null {
    const row = this.#db.get<AccountRow>(
      `SELECT ${kAccountColumns} FROM ${kAccountTables} WHERE users.id = ?`,
      id
    );

    return row === undefined ? null : rehydrate(row);
  }

  named(
    username: Username
  ): AccountEntity | null {
    return this.credentials(username)?.account ?? null;
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
      account: rehydrate(row),
      hash: {
        digest: Buffer.from(row.digest),
        salt: Buffer.from(row.salt)
      }
    };
  }

  insert(
    account: AccountEntity,
    username: Username,
    hash: PasswordHash
  ): void {
    this.#db.run(
      `INSERT INTO users (id, username, username_key, digest, salt, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      account.id,
      account.username,
      username.key,
      hash.digest,
      hash.salt,
      account.role,
      account.status,
      Date.now()
    );
    this.#saveOwnership(account);
  }

  save(
    account: AccountEntity
  ): void {
    this.#db.run(
      "UPDATE users SET role = ?, status = ? WHERE id = ?",
      account.role,
      account.status,
      account.id
    );
    this.#saveOwnership(account);
  }

  delete(
    id: string
  ): void {
    this.#db.run(
      "DELETE FROM users WHERE id = ?",
      id
    );
  }

  * [Symbol.iterator](): IterableIterator<AccountEntity> {
    const rows = this.#db.all<AccountRow>(
      `SELECT ${kAccountColumns} FROM ${kAccountTables} ORDER BY users.created_at, users.rowid`
    );
    for (const row of rows) {
      yield rehydrate(row);
    }
  }

  #saveOwnership(
    account: AccountEntity
  ): void {
    if (account.owner) {
      this.#db.run(
        `INSERT INTO ownership (singleton, user_id) VALUES (1, ?)
         ON CONFLICT (singleton) DO UPDATE SET user_id = excluded.user_id`,
        account.id
      );
    }
  }
}

function rehydrate(
  row: AccountRow
): AccountEntity {
  return new AccountEntity({
    ...row,
    owner: row.owner === 1
  });
}
