// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import type {
  DatabaseSync,
  SQLInputValue,
  StatementSync
} from "node:sqlite";

// Import Internal Dependencies
import { EventLogClosedError } from "../errors/EventLogClosedError.ts";
import { SQL_SCHEMA } from "./schema.ts";

// CONSTANTS
const kInMemoryLocation = ":memory:";
const kIncrementalVacuum = 2;

export class SqliteDatabase {
  #db: DatabaseSync;
  #statements = new Map<string, StatementSync>();
  #reclaimStatement: string;
  #closed = false;

  static async open(
    location: string = kInMemoryLocation
  ): Promise<SqliteDatabase> {
    const { DatabaseSync } = await import("node:sqlite");

    if (location !== kInMemoryLocation) {
      await fs.mkdir(
        path.dirname(location),
        { recursive: true }
      );
    }

    const db = new DatabaseSync(location);
    if (location !== kInMemoryLocation) {
      enableIncrementalVacuum(db);
      db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }
    db.exec(SQL_SCHEMA);

    return new SqliteDatabase(db);
  }

  constructor(
    db: DatabaseSync
  ) {
    this.#db = db;
    this.#reclaimStatement = usesIncrementalVacuum(db) ?
      "PRAGMA incremental_vacuum" :
      "VACUUM";
  }

  all<TRow>(
    sql: string,
    ...parameters: SQLInputValue[]
  ): TRow[] {
    return this.#prepare(sql).all(...parameters) as unknown as TRow[];
  }

  get<TRow>(
    sql: string,
    ...parameters: SQLInputValue[]
  ): TRow | undefined {
    return this.#prepare(sql).get(...parameters) as TRow | undefined;
  }

  run(
    sql: string,
    ...parameters: SQLInputValue[]
  ): number {
    const { changes } = this.#prepare(sql).run(...parameters);

    return Number(changes);
  }

  reclaim(): void {
    this.assertOpen();
    this.#db.exec(this.#reclaimStatement);
  }

  assertOpen(): void {
    if (this.#closed) {
      throw new EventLogClosedError();
    }
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#statements.clear();
    this.#db.close();
  }

  #prepare(
    sql: string
  ): StatementSync {
    this.assertOpen();

    let statement = this.#statements.get(sql);
    if (statement === undefined) {
      statement = this.#db.prepare(sql);
      this.#statements.set(sql, statement);
    }

    return statement;
  }
}

function enableIncrementalVacuum(
  db: DatabaseSync
): void {
  if (usesIncrementalVacuum(db)) {
    return;
  }

  db.exec("PRAGMA auto_vacuum = INCREMENTAL");
  const tables = db.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_schema"
  ).get();
  if (Number(tables?.count ?? 0) > 0) {
    db.exec("VACUUM");
  }
}

function usesIncrementalVacuum(
  db: DatabaseSync
): boolean {
  return db.prepare("PRAGMA auto_vacuum").get()?.auto_vacuum ===
    kIncrementalVacuum;
}
