// Import Internal Dependencies
import type { EventStore } from "../EventStore.ts";
import { createMemoryEventStore } from "./memory/index.ts";

export const persistence = {
  memory: createMemoryEventStore,
  sqlite: async(
    location?: string
  ): Promise<EventStore> => {
    const { createSqliteEventStore } = await import("./sqlite/index.ts");

    return createSqliteEventStore(location);
  }
} as const;

export {
  MemoryEventWriter,
  MemoryEventReader
} from "./memory/index.ts";
export type {
  SqliteEventWriter,
  SqliteEventReader
} from "./sqlite/index.ts";
