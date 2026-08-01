// Import Node.js Dependencies
import type { DatabaseSync } from "node:sqlite";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  wrap,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  AppendInput,
  EventWriter,
  EventStoreEventMap,
  Event
} from "../../EventStore.ts";

export class SqliteEventWriter extends Emitter<
  EventStoreEventMap
> implements EventWriter {
  #db: DatabaseSync;

  constructor(
    db: DatabaseSync
  ) {
    super();
    this.#db = db;
  }

  append(
    input: AppendInput
  ): Result<Event, Error> {
    return wrap<Event, Error>(
      () => this.#append(input)
    )
      .andTee((event) => this.emit("append", event))
      .orTee((error) => this.emit("error", error, input));
  }

  #append(
    input: AppendInput
  ): Event {
    const {
      assetType,
      assetId,
      eventType,
      eventData
    } = input;

    const eventVersion = this.#currentVersion(assetId) + 1;
    const createdAt = new Date().toISOString();

    const { lastInsertRowid } = this.#db.prepare(
      `INSERT INTO events (asset_type, asset_id, event_type, event_data, event_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(assetType, assetId, eventType, JSON.stringify(eventData), eventVersion, createdAt);

    return {
      eventId: Number(lastInsertRowid),
      assetType,
      assetId,
      eventType,
      eventData,
      eventVersion,
      createdAt
    };
  }

  #currentVersion(
    assetId: string
  ): number {
    const row = this.#db.prepare(
      "SELECT COALESCE(MAX(event_version), 0) AS version FROM events WHERE asset_id = ?"
    ).get(assetId) as { version: number; };

    return row.version;
  }
}
