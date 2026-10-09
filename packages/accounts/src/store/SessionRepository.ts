// Import Internal Dependencies
import type { SessionToken } from "../session/SessionToken.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

interface SessionRow {
  user_id: string;
}

export class SessionRepository {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  open(
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

  owner(
    token: SessionToken
  ): string | null {
    const row = this.#db.get<SessionRow>(
      "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
      token.digest,
      Date.now()
    );

    return row?.user_id ?? null;
  }

  close(
    token: SessionToken
  ): string | null {
    const row = this.#db.get<SessionRow>(
      "DELETE FROM sessions WHERE token_hash = ? RETURNING user_id",
      token.digest
    );

    return row?.user_id ?? null;
  }
}
