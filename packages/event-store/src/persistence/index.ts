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

export { createEventStore } from "./createEventStore.ts";
export type { EventLog } from "./EventLog.ts";
