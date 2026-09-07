// Import Internal Dependencies
import type {
  CompactOptions,
  EventStore
} from "../EventStore.ts";
import type { EventLog } from "./EventLog.ts";
import { EventStoreWriter } from "./EventStoreWriter.ts";

export function createEventStore(
  log: EventLog
): EventStore {
  return {
    writer: new EventStoreWriter(log),
    reader: log,
    compact: (options: CompactOptions) => log.compact(options),
    close: () => log.close(),
    [Symbol.dispose]: () => log.close()
  };
}
