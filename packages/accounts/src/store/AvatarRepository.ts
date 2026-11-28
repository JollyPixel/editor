// Import Internal Dependencies
import type { StoredAvatar } from "../avatar/AvatarImage.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

// CONSTANTS
const kTables = {
  account: {
    table: "avatars",
    key: "user_id"
  },
  agent: {
    table: "agent_avatars",
    key: "token_id"
  }
} as const;

export type AvatarOwner = keyof typeof kTables;

export class AvatarRepository {
  #db: SqliteDatabase;
  #replace: string;
  #find: string;

  constructor(
    db: SqliteDatabase,
    owner: AvatarOwner
  ) {
    const { table, key } = kTables[owner];
    this.#db = db;
    this.#replace = `INSERT INTO ${table} (${key}, hash, bytes) VALUES (?, ?, ?)
       ON CONFLICT (${key}) DO UPDATE SET hash = excluded.hash, bytes = excluded.bytes`;
    this.#find = `SELECT hash, bytes FROM ${table} WHERE ${key} = ?`;
  }

  replace(
    ownerId: string,
    avatar: StoredAvatar
  ): void {
    this.#db.run(
      this.#replace,
      ownerId,
      avatar.hash,
      avatar.bytes
    );
  }

  find(
    ownerId: string
  ): StoredAvatar | null {
    const row = this.#db.get<StoredAvatar>(this.#find, ownerId);

    return row === undefined ?
      null :
      {
        hash: row.hash,
        bytes: row.bytes
      };
  }
}
