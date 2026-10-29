// Import Internal Dependencies
import type {
  EventTag,
  EventTagInput
} from "../../EventStore.ts";
import type { TagLog } from "../EventLog.ts";
import { TagRecord } from "../TagRecord.ts";
import { EventTagConflictError } from "../errors/EventTagConflictError.ts";
import { UnknownEventError } from "../errors/UnknownEventError.ts";
import type { SqliteDatabase } from "./database.ts";

// CONSTANTS
const kUniqueConstraintFailed = 2067;
const kTagColumns = [
  "asset_id",
  "name",
  "event_version",
  "message",
  "actor",
  "created_at"
].join(", ");

interface TagRow {
  asset_id: string;
  name: string;
  event_version: number;
  message: string | null;
  actor: string;
  created_at: string;
}

export class SqliteTagTable implements TagLog {
  #database: SqliteDatabase;

  constructor(
    database: SqliteDatabase
  ) {
    this.#database = database;
  }

  async insert(
    input: EventTagInput
  ): Promise<EventTag> {
    this.#database.assertOpen();

    const record = TagRecord.encode(input);
    if (this.#insertRow(record) === 0) {
      throw new UnknownEventError(
        record.assetId,
        record.eventVersion
      );
    }

    return record.toEventTag();
  }

  async get(
    assetId: string,
    name: string
  ): Promise<EventTag | undefined> {
    const row = this.#database.get<TagRow>(
      `SELECT ${kTagColumns}
       FROM tags
       WHERE asset_id = ? AND name = ?`,
      assetId,
      name
    );

    return row === undefined ? undefined : toTag(row);
  }

  async list(
    assetId?: string
  ): Promise<EventTag[]> {
    return this.#database
      .all<TagRow>(
        `SELECT ${kTagColumns}
         FROM tags
         WHERE ? IS NULL OR asset_id = ?
         ORDER BY tag_id ASC`,
        assetId ?? null,
        assetId ?? null
      )
      .map((row) => toTag(row));
  }

  async delete(
    assetId: string,
    name: string
  ): Promise<boolean> {
    return this.#database.run(
      "DELETE FROM tags WHERE asset_id = ? AND name = ?",
      assetId,
      name
    ) > 0;
  }

  #insertRow(
    record: TagRecord
  ): number {
    try {
      return this.#database.run(
        `INSERT INTO tags (asset_id, name, event_version, message, actor,
             created_at)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM events
             WHERE asset_id = ? AND event_version = ?
           )`,
        record.assetId,
        record.name,
        record.eventVersion,
        record.message,
        record.actorJson,
        record.createdAt,
        record.assetId,
        record.eventVersion
      );
    }
    catch (error) {
      if (isUniqueViolation(error)) {
        throw new EventTagConflictError(
          record.assetId,
          record.name,
          { cause: error }
        );
      }
      throw error;
    }
  }
}

function toTag(
  row: TagRow
): EventTag {
  const record = new TagRecord({
    assetId: row.asset_id,
    name: row.name,
    eventVersion: row.event_version,
    message: row.message,
    actorJson: row.actor,
    createdAt: row.created_at
  });

  return record.toEventTag();
}

function isUniqueViolation(
  error: unknown
): boolean {
  return error instanceof Error &&
    "errcode" in error &&
    error.errcode === kUniqueConstraintFailed;
}
