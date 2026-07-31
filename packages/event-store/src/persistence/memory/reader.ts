// Import Internal Dependencies
import type {
  EventReader,
  Event
} from "../../EventStore.ts";
import type { MemoryEventLog } from "./log.ts";

export class MemoryEventReader implements EventReader {
  #log: MemoryEventLog;

  constructor(
    log: MemoryEventLog
  ) {
    this.#log = log;
  }

  list(
    assetId: string,
    fromVersion = 0
  ): Event[] {
    return this.#log.select(assetId, fromVersion);
  }
}
