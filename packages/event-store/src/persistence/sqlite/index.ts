// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { SQL_SCHEMA } from "./schema.ts";
import { SqliteEventLog } from "./log.ts";

// CONSTANTS
const kInMemoryLocation = ":memory:";

export async function createSqliteEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  location: string = kInMemoryLocation
): Promise<TypedEventStore<TMap>> {
  const { DatabaseSync } = await import("node:sqlite");

  if (location !== kInMemoryLocation) {
    await fs.mkdir(
      path.dirname(location),
      { recursive: true }
    );
  }

  const db = new DatabaseSync(location);
  db.exec(SQL_SCHEMA);

  return createEventStore<TMap>(
    new SqliteEventLog(db)
  );
}

export { SQL_SCHEMA } from "./schema.ts";
export { SqliteEventLog } from "./log.ts";
