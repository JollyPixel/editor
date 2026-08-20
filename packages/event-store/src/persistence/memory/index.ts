// Import Internal Dependencies
import type { EventStore } from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { MemoryEventLog } from "./log.ts";

export function createMemoryEventStore(): EventStore {
  return createEventStore(
    new MemoryEventLog()
  );
}

export { MemoryEventLog } from "./log.ts";
