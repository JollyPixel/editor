// Import Internal Dependencies
import type { AgentToken } from "../agent/AgentToken.ts";
import type { SessionToken } from "../session/SessionToken.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

// CONSTANTS
const kColumns = "id, owner_id, name, created_at";

interface AgentTokenRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: number;
}

export class AgentTokenRepository {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  insert(
    token: AgentToken,
    value: SessionToken
  ): void {
    this.#db.run(
      `INSERT INTO agent_tokens (id, token_hash, owner_id, name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      token.id,
      value.digest,
      token.ownerId,
      token.name,
      token.createdAt
    );
  }

  live(
    value: SessionToken
  ): AgentToken | null {
    const row = this.#db.get<AgentTokenRow>(
      `SELECT ${kColumns} FROM agent_tokens
       WHERE token_hash = ? AND revoked_at IS NULL`,
      value.digest
    );

    return row === undefined ? null : toAgentToken(row);
  }

  byId(
    id: string
  ): AgentToken | null {
    const row = this.#db.get<AgentTokenRow>(
      `SELECT ${kColumns} FROM agent_tokens WHERE id = ?`,
      id
    );

    return row === undefined ? null : toAgentToken(row);
  }

  ownedBy(
    ownerId: string
  ): AgentToken[] {
    return this.#db.all<AgentTokenRow>(
      `SELECT ${kColumns} FROM agent_tokens
       WHERE owner_id = ? AND revoked_at IS NULL
       ORDER BY created_at, rowid`,
      ownerId
    ).map(toAgentToken);
  }

  revoke(
    id: string,
    ownerId: string,
    now: number
  ): AgentToken | null {
    const row = this.#db.get<AgentTokenRow>(
      `UPDATE agent_tokens SET revoked_at = ?
       WHERE id = ? AND owner_id = ? AND revoked_at IS NULL
       RETURNING ${kColumns}`,
      now,
      id,
      ownerId
    );

    return row === undefined ? null : toAgentToken(row);
  }
}

function toAgentToken(
  row: AgentTokenRow
): AgentToken {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at
  };
}
