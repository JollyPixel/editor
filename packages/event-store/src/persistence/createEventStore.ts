// Import Internal Dependencies
import type {
  CompactOptions,
  EventDataMap,
  TypedEventStore
} from "../EventStore.ts";
import type {
  EventLog
} from "./EventLog.ts";
import {
  EventStoreWriter
} from "./EventStoreWriter.ts";

export function createEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  log: EventLog
): TypedEventStore<TMap> {
  const writer = new EventStoreWriter(log) as unknown as
    TypedEventStore<TMap>["writer"];

  return {
    writer,
    reader: log,
    compact: (
      options: CompactOptions
    ) => log.compact(options),
    close: () => log.close(),
    [Symbol.dispose]: () => log.close()
  };
}
