// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import type {
  DatabaseSync,
  SQLInputValue
} from "node:sqlite";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ENTRY_CATEGORIES,
  actorKey,
  entryAssetId,
  entrySpan,
  entryVersions,
  type AuditEntry,
  type AuditRecord
} from "./AuditEntry.ts";
import { migrateLegacyEvents } from "./legacyAuditEvents.ts";
import {
  ACCOUNTS_CATEGORY,
  type AuditFilter
} from "../api.ts";

// CONSTANTS
export const AUDIT_DATABASE_FILE = "audit.db";
export const AUDIT_STATE_IGNORES = [
  AUDIT_DATABASE_FILE,
  `${AUDIT_DATABASE_FILE}-journal`,
  `${AUDIT_DATABASE_FILE}-wal`,
  `${AUDIT_DATABASE_FILE}-shm`
];
const kInMemoryLocation = ":memory:";
const kSchema = `
CREATE TABLE IF NOT EXISTS audit_rows (
  row_id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  category TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  asset_id TEXT,
  from_version INTEGER,
  to_version INTEGER,
  entry TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_rows (at, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_rows (category, at, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_rows (actor_key, at, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_asset ON audit_rows (asset_id, at, row_id);
`;
const kKeptVersions = "(from_version IS NOT NULL OR to_version IS NOT NULL)";

export interface AuditSelection extends AuditFilter {
  withoutAccounts: boolean;
}

export interface AuditPosition {
  at: number;
  id: number;
}

export interface KeptVersion {
  assetId: string;
  version: number;
}

export type PagedRecord = AuditRecord & AuditPosition;

interface StoredRow {
  row_id: number;
  at: number;
  entry: string;
}

interface StoredVersions {
  asset_id: string;
  from_version: number | null;
  to_version: number | null;
}

interface WhereClause {
  sql: string;
  parameters: SQLInputValue[];
}

export class AuditLog implements Disposable {
  static async open(
    location: string | null
  ): Promise<AuditLog> {
    const { DatabaseSync } = await import("node:sqlite");
    if (location !== null) {
      await fs.mkdir(
        path.dirname(location),
        { recursive: true }
      );
    }

    const db = new DatabaseSync(location ?? kInMemoryLocation);
    if (location !== null) {
      db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }
    db.exec(kSchema);
    const log = new AuditLog(db);
    log.#transaction(
      () => migrateLegacyEvents(db, (entry) => log.record(entry))
    );

    return log;
  }

  #db: DatabaseSync;

  private constructor(
    db: DatabaseSync
  ) {
    this.#db = db;
  }

  record(
    entry: AuditEntry
  ): number {
    const { start, end } = entrySpan(entry);
    const versions = entryVersions(entry);
    const { lastInsertRowid } = this.#db.prepare(`
      INSERT INTO audit_rows (
        at, started_at, category, actor_key, asset_id,
        from_version, to_version, entry
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      end,
      start,
      ENTRY_CATEGORIES[entry.type],
      actorKey(entry.actor),
      entryAssetId(entry),
      versions.from,
      versions.to,
      JSON.stringify(entry)
    );

    return Number(lastInsertRowid);
  }

  revise(
    record: AuditRecord
  ): void {
    const { start, end } = entrySpan(record.entry);
    const versions = entryVersions(record.entry);
    this.#db.prepare(`
      UPDATE audit_rows
      SET at = ?, started_at = ?, from_version = ?, to_version = ?, entry = ?
      WHERE row_id = ?
    `).run(
      end,
      start,
      versions.from,
      versions.to,
      JSON.stringify(record.entry),
      record.id
    );
  }

  page(
    selection: AuditSelection,
    limit: number,
    after?: AuditPosition
  ): PagedRecord[] {
    const where = whereClause(selection, after);
    const rows = this.#db.prepare(`
      SELECT row_id, at, entry
      FROM audit_rows
      ${where.sql}
      ORDER BY at DESC, row_id DESC
      LIMIT ?
    `).all(...where.parameters, limit) as unknown as StoredRow[];

    return rows.map((row) => {
      return {
        id: row.row_id,
        at: row.at,
        entry: JSON.parse(row.entry) as AuditEntry
      };
    });
  }

  actors(
    selection: AuditSelection
  ): EventStore.Actor[] {
    const where = whereClause(selection);
    const rows = this.#db.prepare(`
      SELECT json_extract(entry, '$.actor') AS actor
      FROM audit_rows
      ${where.sql}
      GROUP BY actor_key
    `).all(...where.parameters) as unknown as { actor: string; }[];

    return rows.map((row) => JSON.parse(row.actor) as EventStore.Actor);
  }

  references(
    kept: KeptVersion
  ): boolean {
    const row = this.#db.prepare(`
      SELECT 1 FROM audit_rows
      WHERE asset_id = ? AND (from_version = ? OR to_version = ?)
      LIMIT 1
    `).get(kept.assetId, kept.version, kept.version);

    return row !== undefined;
  }

  prune(
    before: number
  ): KeptVersion[] {
    return this.#transaction(() => {
      const versions = this.#versionsBefore(before);
      this.#db.prepare("DELETE FROM audit_rows WHERE at < ?").run(before);

      return versions;
    });
  }

  forgetVersions(
    before: number
  ): KeptVersion[] {
    return this.#transaction(() => {
      const versions = this.#versionsBefore(before);
      this.#db.prepare(`
        UPDATE audit_rows
        SET from_version = NULL, to_version = NULL,
          entry = json_set(entry, '$.versions.from', NULL, '$.versions.to', NULL)
        WHERE at < ? AND ${kKeptVersions}
      `).run(before);

      return versions;
    });
  }

  close(): void {
    if (this.#db.isOpen) {
      this.#db.close();
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  #versionsBefore(
    before: number
  ): KeptVersion[] {
    const rows = this.#db.prepare(`
      SELECT asset_id, from_version, to_version FROM audit_rows
      WHERE at < ? AND ${kKeptVersions}
    `).all(before) as unknown as StoredVersions[];

    return rows.flatMap((row) => [row.from_version, row.to_version]
      .filter((version) => version !== null)
      .map((version) => {
        return {
          assetId: row.asset_id,
          version
        };
      }));
  }

  #transaction<TResult>(
    body: () => TResult
  ): TResult {
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
}

function whereClause(
  selection: AuditSelection,
  after?: AuditPosition
): WhereClause {
  const conditions: string[] = [];
  const parameters: SQLInputValue[] = [];
  function filter(
    condition: string,
    ...values: SQLInputValue[]
  ): void {
    conditions.push(condition);
    parameters.push(...values);
  }

  if (selection.withoutAccounts) {
    filter("category <> ?", ACCOUNTS_CATEGORY);
  }
  if (selection.category !== undefined) {
    filter("category = ?", selection.category);
  }
  if (selection.actor !== undefined) {
    filter("actor_key = ?", selection.actor);
  }
  if (selection.asset !== undefined) {
    filter("asset_id = ?", selection.asset);
  }
  if (selection.from !== undefined) {
    filter("at >= ?", selection.from);
  }
  if (selection.to !== undefined) {
    filter("started_at <= ?", selection.to);
  }
  if (after !== undefined) {
    filter("(at, row_id) < (?, ?)", after.at, after.id);
  }

  return {
    sql: conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`,
    parameters
  };
}
