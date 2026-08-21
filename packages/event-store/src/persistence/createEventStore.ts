// Import Internal Dependencies
import type { EventStore } from "../EventStore.ts";
import type { EventLog } from "./EventLog.ts";
import { EventStoreWriter } from "./EventStoreWriter.ts";

export function createEventStore(
  log: EventLog
): EventStore {
  return {
    writer: new EventStoreWriter(log),
    reader: log,
    close: () => log.close(),
    [Symbol.dispose]: () => log.close()
  };
}
