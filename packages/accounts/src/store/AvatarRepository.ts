// Import Internal Dependencies
import type { StoredAvatar } from "../avatar/AvatarImage.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

export class AvatarRepository {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  replace(
    accountId: string,
    avatar: StoredAvatar
  ): void {
    this.#db.run(
      `INSERT INTO avatars (user_id, hash, bytes) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET hash = excluded.hash, bytes = excluded.bytes`,
      accountId,
      avatar.hash,
      avatar.bytes
    );
  }

  find(
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
}
