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
    realmId: string,
    token: AgentToken,
    value: SessionToken
  ): void {
    this.#db.run(
      `INSERT INTO agent_tokens (id, realm_id, token_hash, owner_id, name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      token.id,
      realmId,
      value.digest,
      token.ownerId,
      token.name,
      token.createdAt
    );
  }

  live(
    realmId: string,
    value: SessionToken
  ): AgentToken | null {
    const row = this.#db.get<AgentTokenRow>(
      `SELECT ${kColumns} FROM agent_tokens
       WHERE realm_id = ? AND token_hash = ? AND revoked_at IS NULL`,
      realmId,
      value.digest
    );

    return row === undefined ? null : toAgentToken(row);
  }

  byId(
    realmId: string,
    id: string
  ): AgentToken | null {
    const row = this.#db.get<AgentTokenRow>(
      `SELECT ${kColumns} FROM agent_tokens WHERE realm_id = ? AND id = ?`,
      realmId,
      id
    );

    return row === undefined ? null : toAgentToken(row);
  }

  ownedBy(
    realmId: string,
    ownerId: string
  ): AgentToken[] {
    return this.#db.all<AgentTokenRow>(
      `SELECT ${kColumns} FROM agent_tokens
       WHERE realm_id = ? AND owner_id = ? AND revoked_at IS NULL
       ORDER BY created_at, rowid`,
      realmId,
      ownerId
    ).map(toAgentToken);
  }

  liveIdsOwnedBy(
    ownerId: string
  ): string[] {
    return this.#db.all<Pick<AgentTokenRow, "id">>(
      `SELECT id FROM agent_tokens WHERE owner_id = ? AND revoked_at IS NULL
       ORDER BY created_at, rowid`,
      ownerId
    ).map((row) => row.id);
  }

  revokeOwnedBy(
    realmId: string,
    ownerId: string,
    now: number
  ): AgentToken[] {
    return this.#db.all<AgentTokenRow>(
      `UPDATE agent_tokens SET revoked_at = ?
       WHERE realm_id = ? AND owner_id = ? AND revoked_at IS NULL
       RETURNING ${kColumns}`,
      now,
      realmId,
      ownerId
    ).map(toAgentToken);
  }

  revoke(
    realmId: string,
    id: string,
    ownerId: string,
    now: number
  ): AgentToken | null {
    const row = this.#db.get<AgentTokenRow>(
      `UPDATE agent_tokens SET revoked_at = ?
       WHERE realm_id = ? AND id = ? AND owner_id = ? AND revoked_at IS NULL
       RETURNING ${kColumns}`,
      now,
      realmId,
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
