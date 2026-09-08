// Import Node.js Dependencies
import type {
  DatabaseSync,
  SQLInputValue
} from "node:sqlite";

// Import Internal Dependencies
import type {
  AppendInput,
  CompactOptions,
  CompactReport,
  Event,
  ListAllOptions,
  ListFromCheckpointsOptions
} from "../../EventStore.ts";
import {
  EventLogClosedError,
  type EventLog
} from "../EventLog.ts";
import {
  materializeEvent,
  toJson
} from "../serialize.ts";
import { SqliteConnection } from "./connection.ts";
import {
  ALIASED_EVENT_COLUMNS,
  EVENT_COLUMNS,
  toEvent,
  type EventRow
} from "./rows.ts";
import {
  escapeGlob,
  placeholdersFor
} from "./sql.ts";

export class SqliteEventLog implements EventLog {
  #connection: SqliteConnection;

  constructor(
    db: DatabaseSync
  ) {
    this.#connection = new SqliteConnection(db);
  }

  insert(
    input: AppendInput
  ): Event {
    this.#assertOpen();

    const {
      assetType,
      assetId,
      eventType,
      eventData,
      actor
    } = input;

    const eventDataJson = toJson(eventData, "eventData");
    const actorJson = toJson(actor, "actor");
    const createdAt = new Date().toISOString();

    const row = this.#connection.get<{
      event_id: number;
      event_version: number;
    }>(
      `INSERT INTO events (asset_type, asset_id, event_type, event_data,
           event_version, actor, created_at)
         VALUES (?, ?, ?, ?,
           (SELECT COALESCE(MAX(event_version), 0) + 1 FROM events WHERE asset_id = ?),
           ?, ?)
         RETURNING event_id, event_version`,
      assetType,
      assetId,
      eventType,
      eventDataJson,
      assetId,
      actorJson,
      createdAt
    );
    if (row === undefined) {
      throw new Error("insert did not return the stored event");
    }

    return materializeEvent({
      eventId: row.event_id,
      assetType,
      assetId,
      eventType,
      eventDataJson,
      eventVersion: row.event_version,
      actorJson,
      createdAt
    });
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    return this.#query(
      `SELECT ${EVENT_COLUMNS}
       FROM events
       WHERE asset_id = ? AND event_version > ?
       ORDER BY event_version ASC`,
      assetId,
      fromVersion
    );
  }

  listFromCheckpoint(
    assetId: string,
    checkpointEventTypes: readonly string[]
  ): Event[] {
    if (checkpointEventTypes.length === 0) {
      return this.list(assetId);
    }

    const placeholders = placeholdersFor(checkpointEventTypes);

    return this.#query(
      `SELECT ${EVENT_COLUMNS}
       FROM events
       WHERE asset_id = ?
         AND event_version >= COALESCE((
           SELECT MAX(event_version)
           FROM events
           WHERE asset_id = ? AND event_type IN (${placeholders})
         ), 0)
       ORDER BY event_version ASC`,
      assetId,
      assetId,
      ...checkpointEventTypes
    );
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
      `SELECT ${EVENT_COLUMNS}
       FROM events
       WHERE ${conditions.join(" AND ")}
       ORDER BY event_id ASC
       ${limit === undefined ? "" : "LIMIT ?"}`,
      ...parameters
    );
  }

  listFromCheckpoints(
    options: ListFromCheckpointsOptions
  ): Event[] {
    const {
      checkpointEventTypes,
      eventTypePrefix
    } = options;
    if (checkpointEventTypes.length === 0) {
      return this.listAll({ eventTypePrefix });
    }

    const parameters: SQLInputValue[] = [...checkpointEventTypes];
    let prefixCondition = "";
    if (eventTypePrefix !== undefined) {
      prefixCondition = "AND e.event_type GLOB ?";
      parameters.push(`${escapeGlob(eventTypePrefix)}*`);
    }

    return this.#query(
      `WITH heads AS (
         SELECT asset_id, MAX(event_id) AS head
         FROM events
         WHERE event_type IN (${placeholdersFor(checkpointEventTypes)})
         GROUP BY asset_id
       )
       SELECT ${ALIASED_EVENT_COLUMNS}
       FROM events e
       LEFT JOIN heads h ON h.asset_id = e.asset_id
       WHERE e.event_id >= COALESCE(h.head, 0) ${prefixCondition}
       ORDER BY e.event_id ASC`,
      ...parameters
    );
  }

  compact(
    options: CompactOptions
  ): CompactReport {
    this.#assertOpen();

    const {
      checkpointEventTypes,
      reclaim = true
    } = options;
    if (checkpointEventTypes.length === 0) {
      return {
        removed: 0,
        assets: 0
      };
    }

    const placeholders = placeholdersFor(checkpointEventTypes);
    const counted = this.#connection.get<{ assets: number; }>(
      `SELECT COUNT(DISTINCT asset_id) AS assets
       FROM events
       WHERE event_type IN (${placeholders})`,
      ...checkpointEventTypes
    );

    const removed = this.#connection.run(
      `DELETE FROM events
       WHERE event_id IN (
         SELECT e.event_id
         FROM events e
         JOIN (
           SELECT asset_id, MAX(event_id) AS head
           FROM events
           WHERE event_type IN (${placeholders})
           GROUP BY asset_id
         ) h ON h.asset_id = e.asset_id
         WHERE e.event_id < h.head
       )`,
      ...checkpointEventTypes
    );

    if (reclaim && removed > 0) {
      this.#connection.exec("VACUUM");
    }

    return {
      removed,
      assets: counted?.assets ?? 0
    };
  }

  close(): void {
    this.#connection.close();
  }

  #query(
    sql: string,
    ...parameters: SQLInputValue[]
  ): Event[] {
    this.#assertOpen();

    return this.#connection
      .all<EventRow>(sql, ...parameters)
      .map((row) => toEvent(row));
  }

  #assertOpen(): void {
    if (this.#connection.closed) {
      throw new EventLogClosedError();
    }
  }
}
