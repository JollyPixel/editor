// Import Internal Dependencies
import type { EventStore } from "../../EventStore.ts";
import { createEventStore } from "../createEventStore.ts";
import { SQL_SCHEMA } from "./schema.ts";
import { SqliteEventLog } from "./log.ts";

export async function createSqliteEventStore(
  location: string = ":memory:"
): Promise<EventStore> {
  const { DatabaseSync } = await import("node:sqlite");

  const db = new DatabaseSync(location);
  db.exec(SQL_SCHEMA);

  return createEventStore(
    new SqliteEventLog(db)
  );
}

export { SQL_SCHEMA } from "./schema.ts";
export { SqliteEventLog } from "./log.ts";
