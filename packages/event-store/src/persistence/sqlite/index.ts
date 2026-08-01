// Import Node.js Dependencies
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import type { EventStore } from "../../EventStore.ts";
import { SqliteEventWriter } from "./writer.ts";
import { SqliteEventReader } from "./reader.ts";

// CONSTANTS
const kSQLSchema = readFileSync(
  path.join(import.meta.dirname, "schema.sql"),
  "utf8"
);

export function createSqliteEventStore(
  location: string = ":memory:"
): EventStore {
  const db = new DatabaseSync(location);
  db.exec(kSQLSchema);

  return {
    writer: new SqliteEventWriter(db),
    reader: new SqliteEventReader(db),
    close: () => db.close(),
    [Symbol.dispose]() {
      this.close();
    }
  };
}

export { SqliteEventWriter } from "./writer.ts";
export { SqliteEventReader } from "./reader.ts";
