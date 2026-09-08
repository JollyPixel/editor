// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { SQL_SCHEMA } from "./schema.ts";
import { SqliteEventLog } from "./log.ts";

export async function createSqliteEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  location: string = ":memory:"
): Promise<TypedEventStore<TMap>> {
  const { DatabaseSync } = await import("node:sqlite");

  const db = new DatabaseSync(location);
  db.exec(SQL_SCHEMA);

  return createEventStore<TMap>(
    new SqliteEventLog(db)
  );
}

export { SQL_SCHEMA } from "./schema.ts";
export { SqliteEventLog } from "./log.ts";
