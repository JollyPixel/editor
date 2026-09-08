// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { MemoryEventLog } from "./log.ts";

export function createMemoryEventStore<
  TMap extends EventDataMap = EventDataMap
>(): TypedEventStore<TMap> {
  return createEventStore<TMap>(
    new MemoryEventLog()
  );
}

export { MemoryEventLog } from "./log.ts";
