// Import Internal Dependencies
import { createMemoryEventStore } from "./memory/index.ts";
import { createSqliteEventStore } from "./sqlite/index.ts";

export const persistence = {
  memory: createMemoryEventStore,
  sqlite: createSqliteEventStore
} as const;

export {
  MemoryEventWriter,
  MemoryEventReader
} from "./memory/index.ts";
export {
  SqliteEventWriter,
  SqliteEventReader
} from "./sqlite/index.ts";
