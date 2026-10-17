// Import Node.js Dependencies
import type { SQLInputValue } from "node:sqlite";

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
import { EventRecord } from "../EventRecord.ts";
import { EventVersionConflictError } from "../errors/EventVersionConflictError.ts";
import type { SqliteDatabase } from "./database.ts";
import { SqliteTagTable } from "./tags.ts";
import {
  escapeGlob,
  placeholdersFor
} from "./sql.ts";

// CONSTANTS
const kEventColumnNames = [
  "event_id",
  "asset_type",
  "asset_id",
  "event_type",
  "event_data",
  "event_version",
  "actor",
  "created_at"
];
const kEventColumns = kEventColumnNames.join(", ");
const kAliasedEventColumns = kEventColumnNames
  .map((column) => `e.${column}`)
  .join(", ");

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

interface SqlFragment {
  sql: string;
  parameters: SQLInputValue[];
}

export class SqliteEventLog implements EventLog {
  #database: SqliteDatabase;
  readonly tags: SqliteTagTable;

  constructor(
    database: SqliteDatabase
  ) {
    this.#database = database;
    this.tags = new SqliteTagTable(database);
  }

  insert(
    input: AppendInput
  ): Event {
    this.#database.assertOpen();

    const { assetId, expectedVersion } = input;
    const record = EventRecord.encode(input);

    const row = this.#database.get<{
      event_id: number;
      event_version: number;
    }>(
      `INSERT INTO events (asset_type, asset_id, event_type, event_data,
           event_version, actor, created_at)
         SELECT ?, ?, ?, ?, head.version + 1, ?, ?
         FROM (
           SELECT COALESCE((
             SELECT event_version
             FROM events
             WHERE asset_id = ?
             ORDER BY event_version DESC
             LIMIT 1
           ), 0) AS version
         ) head
         WHERE ? IS NULL OR head.version = ?
         RETURNING event_id, event_version`,
      record.assetType,
      assetId,
      record.eventType,
      record.eventDataJson,
      record.actorJson,
      record.createdAt,
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

    return record.toEvent({
      eventId: row.event_id,
      eventVersion: row.event_version
    });
  }

  get(
    assetId: string,
    eventVersion: number
  ): Event | undefined {
    const [event] = this.#query(
      `SELECT ${kEventColumns}
       FROM events
       WHERE asset_id = ? AND event_version = ?`,
      assetId,
      eventVersion
    );

    return event;
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    return this.#query(
      `SELECT ${kEventColumns}
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
      `SELECT ${kEventColumns}
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
       SELECT ${kAliasedEventColumns}
       FROM ${source}
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${order} ASC`,
      ...parameters
    );
  }

  compact(
    options: CompactOptions
  ): CompactReport {
    const {
      checkpointEventTypes,
      reclaim = true,
      assetId
    } = options;

    const heads = this.#checkpointHeads(checkpointEventTypes, assetId);
    const counted = this.#database.get<{ assets: number; }>(
      `${heads.sql}
       SELECT COUNT(*) AS assets
       FROM heads`,
      ...heads.parameters
    );
    const removed = this.#database.run(
      `${heads.sql}
       DELETE FROM events
       WHERE event_id IN (
         SELECT e.event_id
         FROM events e
         JOIN heads h ON h.asset_id = e.asset_id
         WHERE e.event_version < h.head
           AND NOT EXISTS (
             SELECT 1 FROM tags t
             WHERE t.asset_id = e.asset_id
               AND t.event_version = e.event_version
           )
       )`,
      ...heads.parameters
    );

    if (reclaim && removed > 0) {
      this.#database.reclaim();
    }

    return {
      removed,
      assets: counted?.assets ?? 0
    };
  }

  close(): void {
    this.#database.close();
  }

  #head(
    assetId: string
  ): number {
    const row = this.#database.get<{ version: number; }>(
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
    return this.#database
      .all<EventRow>(sql, ...parameters)
      .map((row) => toEvent(row));
  }
}

function toEvent(
  row: EventRow
): Event {
  const record = new EventRecord({
    assetType: row.asset_type,
    assetId: row.asset_id,
    eventType: row.event_type,
    eventDataJson: row.event_data,
    actorJson: row.actor,
    createdAt: row.created_at
  });

  return record.toEvent({
    eventId: row.event_id,
    eventVersion: row.event_version
  });
}
