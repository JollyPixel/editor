// Import Internal Dependencies
import type {
  EventDataMap,
  TypedEventStore
} from "../EventStore.ts";
import { createMemoryEventStore } from "./memory/index.ts";
import {
  createIndexedDbEventStore,
  destroyIndexedDbEventStore
} from "./indexeddb/index.ts";

export type { IndexedDbEventStoreOptions } from "./indexeddb/index.ts";

export const persistence = {
  memory: createMemoryEventStore,
  indexeddb: Object.assign(createIndexedDbEventStore, {
    destroy: destroyIndexedDbEventStore
  }),
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
export { EventTagConflictError } from "./errors/EventTagConflictError.ts";
export { UnknownEventError } from "./errors/UnknownEventError.ts";
