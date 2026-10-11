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
    link: ShareLink
  ): void {
    this.#db.run(
      `INSERT INTO share_links (id, token, asset_id, created_by, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      link.id,
      link.token,
      link.assetId,
      link.createdBy,
      link.createdAt,
      link.expiresAt
    );
  }

  byToken(
    token: string,
    now: number
  ): ShareLink | null {
    const row = this.#db.get<ShareLinkRow>(
      `SELECT ${kColumns} FROM share_links
       WHERE token = ? AND ${kLive}`,
      token,
      now
    );

    return row === undefined ? null : toShareLink(row);
  }

  byId(
    id: string,
    now: number
  ): ShareLink | null {
    const row = this.#db.get<ShareLinkRow>(
      `SELECT ${kColumns} FROM share_links
       WHERE id = ? AND ${kLive}`,
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

  deleteCreatedBy(
    accountId: string
  ): ShareLink[] {
    return this.#db.all<ShareLinkRow>(
      `DELETE FROM share_links WHERE created_by = ? RETURNING ${kColumns}`,
      accountId
    ).map(toShareLink);
  }

  deleteExpired(
    now: number
  ): ShareLink[] {
    return this.#db.all<ShareLinkRow>(
      `DELETE FROM share_links WHERE expires_at <= ? RETURNING ${kColumns}`,
      now
    ).map(toShareLink);
  }

  nextExpiry(): number | null {
    const row = this.#db.get<NextExpiryRow>(
      "SELECT MIN(expires_at) AS expires_at FROM share_links"
    );

    return row?.expires_at ?? null;
  }

  live(
    now: number
  ): ShareLink[] {
    return this.#db.all<ShareLinkRow>(
      `SELECT ${kColumns} FROM share_links WHERE ${kLive}
       ORDER BY created_at, rowid`,
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
