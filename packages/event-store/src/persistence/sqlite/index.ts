// Import Internal Dependencies
import type { EventStore } from "../../EventStore.ts";
import { SQL_SCHEMA } from "./schema.ts";
import { SqliteEventWriter } from "./writer.ts";
import { SqliteEventReader } from "./reader.ts";

export async function createSqliteEventStore(
  location: string = ":memory:"
): Promise<EventStore> {
  const { DatabaseSync } = await import("node:sqlite");

  const db = new DatabaseSync(location);
  db.exec(SQL_SCHEMA);

  const store: EventStore = {
    writer: new SqliteEventWriter(db),
    reader: new SqliteEventReader(db),
    close: () => db.close(),
    [Symbol.dispose]() {
      this.close();
    }
  };

  return store;
}

export { SQL_SCHEMA } from "./schema.ts";
export { SqliteEventWriter } from "./writer.ts";
export { SqliteEventReader } from "./reader.ts";
