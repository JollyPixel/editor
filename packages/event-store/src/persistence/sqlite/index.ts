// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { SqliteEventLog } from "./log.ts";

export async function createSqliteEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  location?: string
): Promise<TypedEventStore<TMap>> {
  return createEventStore<TMap>(
    await SqliteEventLog.open(location)
  );
}
