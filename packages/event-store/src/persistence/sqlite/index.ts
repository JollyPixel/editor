// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { SqliteDatabase } from "./database.ts";
import { SqliteEventLog } from "./log.ts";

export async function createSqliteEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  location?: string
): Promise<TypedEventStore<TMap>> {
  return createEventStore<TMap>(
    new SqliteEventLog(await SqliteDatabase.open(location))
  );
}
