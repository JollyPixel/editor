// Import Node.js Dependencies
import type { DatabaseSync } from "node:sqlite";

// Import Internal Dependencies
import type {
  EventReader,
  Event
} from "../../EventStore.ts";

interface EventRow {
  event_id: number;
  asset_type: string;
  asset_id: string;
  event_type: string;
  event_data: string;
  event_version: number;
  created_at: string;
}

export class SqliteEventReader implements EventReader {
  #db: DatabaseSync;

  constructor(
    db: DatabaseSync
  ) {
    this.#db = db;
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    const rows = this.#db.prepare(
      `SELECT event_id, asset_type, asset_id, event_type, event_data, event_version, created_at
       FROM events
       WHERE asset_id = ? AND event_version > ?
       ORDER BY event_version ASC`
    ).all(assetId, fromVersion) as unknown as EventRow[];

    return rows.map((row) => toEvent(row));
  }
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
    createdAt: row.created_at
  };
}
