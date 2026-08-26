// Import Node.js Dependencies
import type {
  DatabaseSync,
  SQLInputValue
} from "node:sqlite";

// Import Internal Dependencies
import type {
  Actor,
  AppendInput,
  Event,
  ListAllOptions
} from "../../EventStore.ts";
import type { EventLog } from "../EventLog.ts";
import { toJson } from "../serialize.ts";

interface EventRow {
  event_id: number;
  asset_type: string;
  asset_id: string;
  event_type: string;
  event_data: string;
  event_version: number;
  actor: string;
  created_at: string;
}

// CONSTANTS
const kColumns = [
  "event_id",
  "asset_type",
  "asset_id",
  "event_type",
  "event_data",
  "event_version",
  "actor",
  "created_at"
].join(", ");

export class SqliteEventLog implements EventLog {
  #db: DatabaseSync;
  #closed = false;

  constructor(
    db: DatabaseSync
  ) {
    this.#db = db;
  }

  insert(
    input: AppendInput
  ): Event {
    const {
      assetType,
      assetId,
      eventType,
      eventData,
      actor
    } = input;

    const sqlInsert = `INSERT INTO events (asset_type, asset_id, event_type, event_data,
        event_version, actor, created_at)
      VALUES (?, ?, ?, ?,
        (SELECT COALESCE(MAX(event_version), 0) + 1 FROM events WHERE asset_id = ?),
        ?, ?)
      RETURNING ${kColumns}`;

    const [row] = this.#query(
      sqlInsert,
      assetType,
      assetId,
      eventType,
      toJson(eventData, "eventData"),
      assetId,
      toJson(actor, "actor"),
      new Date().toISOString()
    );

    return toEvent(row);
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    return this.#query(
      `SELECT ${kColumns}
       FROM events
       WHERE asset_id = ? AND event_version > ?
       ORDER BY event_version ASC`,
      assetId,
      fromVersion
    ).map((row) => toEvent(row));
  }

  lastVersionOf(
    assetId: string,
    eventTypes: readonly string[]
  ): number {
    if (eventTypes.length === 0) {
      return 0;
    }

    const placeholders = eventTypes.map(() => "?").join(", ");
    const row = this.#db.prepare(
      `SELECT MAX(event_version) AS event_version
       FROM events
       WHERE asset_id = ? AND event_type IN (${placeholders})`
    ).get(assetId, ...eventTypes) as { event_version: number | null; } | undefined;

    return row?.event_version ?? 0;
  }

  listAll(
    options: ListAllOptions = {}
  ): Event[] {
    const {
      fromEventId = 0,
      eventTypePrefix,
      limit
    } = options;

    const conditions = ["event_id > ?"];
    const parameters: SQLInputValue[] = [fromEventId];
    if (eventTypePrefix !== undefined) {
      conditions.push("event_type GLOB ?");
      parameters.push(`${escapeGlob(eventTypePrefix)}*`);
    }
    if (limit !== undefined) {
      parameters.push(limit);
    }

    return this.#query(
      `SELECT ${kColumns}
       FROM events
       WHERE ${conditions.join(" AND ")}
       ORDER BY event_id ASC
       ${limit === undefined ? "" : "LIMIT ?"}`,
      ...parameters
    ).map((row) => toEvent(row));
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#db.close();
  }

  #query(
    sql: string,
    ...parameters: SQLInputValue[]
  ): EventRow[] {
    return this.#db.prepare(sql).all(...parameters) as unknown as EventRow[];
  }
}

// Escape GLOB wildcards so prefixes match literally.
function escapeGlob(
  value: string
): string {
  return value.replace(/[[\]*?]/g, (character) => `[${character}]`);
}

function toEvent(
  row: EventRow
): Event {
  return {
    eventId: row.event_id,
    assetType: row.asset_type,
    assetId: row.asset_id,
    eventType: row.event_type,
    eventData: JSON.parse(row.event_data),
    eventVersion: row.event_version,
    actor: JSON.parse(row.actor) as Actor,
    createdAt: row.created_at
  };
}
