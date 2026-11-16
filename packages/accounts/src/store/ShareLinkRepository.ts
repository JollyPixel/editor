// Import Internal Dependencies
import type { ShareLink } from "../share/ShareLink.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

// CONSTANTS
const kColumns = "id, token, asset_id, created_by, created_at, expires_at";
const kLive = "(expires_at IS NULL OR expires_at > ?)";

interface ShareLinkRow {
  id: string;
  token: string;
  asset_id: string;
  created_by: string;
  created_at: number;
  expires_at: number | null;
}

interface NextExpiryRow {
  expires_at: number | null;
}

export class ShareLinkRepository {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  insert(
    realmId: string,
    link: ShareLink
  ): void {
    this.#db.run(
      `INSERT INTO share_links (id, realm_id, token, asset_id, created_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      link.id,
      realmId,
      link.token,
      link.assetId,
      link.createdBy,
      link.createdAt,
      link.expiresAt
    );
  }

  byToken(
    realmId: string,
    token: string,
    now: number
  ): ShareLink | null {
    const row = this.#db.get<ShareLinkRow>(
      `SELECT ${kColumns} FROM share_links
       WHERE realm_id = ? AND token = ? AND ${kLive}`,
      realmId,
      token,
      now
    );

    return row === undefined ? null : toShareLink(row);
  }

  byId(
    realmId: string,
    id: string,
    now: number
  ): ShareLink | null {
    const row = this.#db.get<ShareLinkRow>(
      `SELECT ${kColumns} FROM share_links
       WHERE realm_id = ? AND id = ? AND ${kLive}`,
      realmId,
      id,
      now
    );

    return row === undefined ? null : toShareLink(row);
  }

  delete(
    id: string
  ): ShareLink | null {
    const row = this.#db.get<ShareLinkRow>(
      `DELETE FROM share_links WHERE id = ? RETURNING ${kColumns}`,
      id
    );

    return row === undefined ? null : toShareLink(row);
  }

  idsCreatedBy(
    accountId: string
  ): string[] {
    return this.#db.all<Pick<ShareLinkRow, "id">>(
      "SELECT id FROM share_links WHERE created_by = ?",
      accountId
    ).map((row) => row.id);
  }

  deleteCreatedBy(
    realmId: string,
    accountId: string
  ): ShareLink[] {
    return this.#db.all<ShareLinkRow>(
      `DELETE FROM share_links WHERE realm_id = ? AND created_by = ?
       RETURNING ${kColumns}`,
      realmId,
      accountId
    ).map(toShareLink);
  }

  deleteExpired(
    realmId: string,
    now: number
  ): ShareLink[] {
    return this.#db.all<ShareLinkRow>(
      `DELETE FROM share_links WHERE realm_id = ? AND expires_at <= ?
       RETURNING ${kColumns}`,
      realmId,
      now
    ).map(toShareLink);
  }

  nextExpiry(
    realmId: string
  ): number | null {
    const row = this.#db.get<NextExpiryRow>(
      "SELECT MIN(expires_at) AS expires_at FROM share_links WHERE realm_id = ?",
      realmId
    );

    return row?.expires_at ?? null;
  }

  live(
    realmId: string,
    now: number
  ): ShareLink[] {
    return this.#db.all<ShareLinkRow>(
      `SELECT ${kColumns} FROM share_links WHERE realm_id = ? AND ${kLive}
       ORDER BY created_at, rowid`,
      realmId,
      now
    ).map(toShareLink);
  }
}

function toShareLink(
  row: ShareLinkRow
): ShareLink {
  return {
    id: row.id,
    token: row.token,
    assetId: row.asset_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}
