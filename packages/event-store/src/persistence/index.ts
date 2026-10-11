// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../EventStore.ts";
import { createMemoryEventStore } from "./memory/index.ts";

export const persistence = {
  memory: createMemoryEventStore,
  sqlite: async<
    TMap extends EventDataMap = EventDataMap
  >(
    location?: string
  ): Promise<TypedEventStore<TMap>> => {
    const { createSqliteEventStore } = await import("./sqlite/index.ts");

    return createSqliteEventStore<TMap>(location);
  }
} as const;

export { EventLogClosedError } from "./errors/EventLogClosedError.ts";
export { EventVersionConflictError } from "./errors/EventVersionConflictError.ts";
