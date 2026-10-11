// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
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
import type { EventLog } from "../EventLog.ts";
import { EventLogClosedError } from "../errors/EventLogClosedError.ts";
import {
  materializeEvent,
  toJson
} from "../serialize.ts";
import { EventVersionConflictError } from "../errors/EventVersionConflictError.ts";
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
import { SQL_SCHEMA } from "./schema.ts";
import {
  enableIncrementalVacuum,
  reclaimStatement
} from "./vacuum.ts";

// CONSTANTS
const kInMemoryLocation = ":memory:";

interface SqlFragment {
  sql: string;
  parameters: SQLInputValue[];
}

export class SqliteEventLog implements EventLog {
  #connection: SqliteConnection;
  #reclaimStatement: string;

  static async open(
    location: string = kInMemoryLocation
  ): Promise<SqliteEventLog> {
    const { DatabaseSync } = await import("node:sqlite");

    if (location !== kInMemoryLocation) {
      await fs.mkdir(
        path.dirname(location),
        { recursive: true }
      );
    }

    const db = new DatabaseSync(location);
    if (location !== kInMemoryLocation) {
      enableIncrementalVacuum(db);
      db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }
    db.exec(SQL_SCHEMA);

    return new SqliteEventLog(db);
  }

  constructor(
    db: DatabaseSync
  ) {
    this.#connection = new SqliteConnection(db);
    this.#reclaimStatement = reclaimStatement(db);
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
      actor,
      expectedVersion
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
         SELECT ?, ?, ?, ?, head.version + 1, ?, ?
         FROM (
           SELECT COALESCE(MAX(event_version), 0) AS version
           FROM events
           WHERE asset_id = ?
         ) head
         WHERE ? IS NULL OR head.version = ?
         RETURNING event_id, event_version`,
      assetType,
      assetId,
      eventType,
      eventDataJson,
      actorJson,
      createdAt,
      assetId,
      expectedVersion ?? null,
      expectedVersion ?? null
    );
    if (row === undefined && expectedVersion !== undefined) {
      throw new EventVersionConflictError(
        assetId,
        expectedVersion,
        this.#head(assetId)
      );
    }
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
      eventTypePrefix,
      assetId
    } = options;

    const heads = this.#checkpointHeads(checkpointEventTypes, assetId);
    const { source, conditions, parameters, order } = assetId === undefined ?
      {
        source: "events e LEFT JOIN heads h ON h.asset_id = e.asset_id",
        conditions: ["e.event_version >= COALESCE(h.head, 0)"],
        parameters: [...heads.parameters],
        order: "e.event_id"
      } :
      {
        source: "events e",
        conditions: [
          "e.asset_id = ?",
          "e.event_version >= COALESCE((SELECT head FROM heads), 0)"
        ],
        parameters: [...heads.parameters, assetId],
        order: "e.event_version"
      };
    if (eventTypePrefix !== undefined) {
      conditions.push("e.event_type GLOB ?");
      parameters.push(`${escapeGlob(eventTypePrefix)}*`);
    }

    return this.#query(
      `${heads.sql}
       SELECT ${ALIASED_EVENT_COLUMNS}
       FROM ${source}
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${order} ASC`,
      ...parameters
    );
  }

  compact(
    options: CompactOptions
  ): CompactReport {
    this.#assertOpen();

    const {
      checkpointEventTypes,
      reclaim = true,
      assetId
    } = options;

    const heads = this.#checkpointHeads(checkpointEventTypes, assetId);
    const counted = this.#connection.get<{ assets: number; }>(
      `${heads.sql}
       SELECT COUNT(*) AS assets
       FROM heads`,
      ...heads.parameters
    );
    const removed = this.#connection.run(
      `${heads.sql}
       DELETE FROM events
       WHERE event_id IN (
         SELECT e.event_id
         FROM events e
         JOIN heads h ON h.asset_id = e.asset_id
         WHERE e.event_version < h.head
       )`,
      ...heads.parameters
    );

    if (reclaim && removed > 0) {
      this.#connection.exec(this.#reclaimStatement);
    }

    return {
      removed,
      assets: counted?.assets ?? 0
    };
  }

  close(): void {
    this.#connection.close();
  }

  #head(
    assetId: string
  ): number {
    const row = this.#connection.get<{ version: number; }>(
      `SELECT COALESCE(MAX(event_version), 0) AS version
       FROM events
       WHERE asset_id = ?`,
      assetId
    );

    return row?.version ?? 0;
  }

  #checkpointHeads(
    eventTypes: readonly string[],
    assetId: string | undefined
  ): SqlFragment {
    const parameters: SQLInputValue[] = [...eventTypes];
    let assetCondition = "";
    if (assetId !== undefined) {
      assetCondition = "AND asset_id = ?";
      parameters.push(assetId);
    }

    return {
      sql: `WITH heads AS (
         SELECT asset_id, MAX(event_version) AS head
         FROM events
         WHERE event_type IN (${placeholdersFor(eventTypes)}) ${assetCondition}
         GROUP BY asset_id
       )`,
      parameters
    };
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
