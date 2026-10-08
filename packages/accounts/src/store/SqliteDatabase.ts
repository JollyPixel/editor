// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";
import type {
  DatabaseSync,
  SQLInputValue
} from "node:sqlite";

// CONSTANTS
export const IN_MEMORY_LOCATION = ":memory:";

export class SqliteDatabase implements Disposable {
  static async open(
    location: string = IN_MEMORY_LOCATION
  ): Promise<SqliteDatabase> {
    const { DatabaseSync } = await import("node:sqlite");
    if (location !== IN_MEMORY_LOCATION) {
      await fs.mkdir(
        path.dirname(location),
        { recursive: true }
      );
    }

    const db = new DatabaseSync(location);
    if (location !== IN_MEMORY_LOCATION) {
      db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    }

    return new SqliteDatabase(db);
  }

  #db: DatabaseSync;

  constructor(
    db: DatabaseSync
  ) {
    this.#db = db;
    this.#db.exec("PRAGMA foreign_keys = ON;");
  }

  exec(
    sql: string
  ): void {
    this.#db.exec(sql);
  }

  get<TRow>(
    sql: string,
    ...parameters: SQLInputValue[]
  ): TRow | undefined {
    return this.#db.prepare(sql).get(...parameters) as TRow | undefined;
  }

  all<TRow>(
    sql: string,
    ...parameters: SQLInputValue[]
  ): TRow[] {
    return this.#db.prepare(sql).all(...parameters) as unknown as TRow[];
  }

  run(
    sql: string,
    ...parameters: SQLInputValue[]
  ): void {
    this.#db.prepare(sql).run(...parameters);
  }

  transaction<TResult>(
    body: () => TResult
  ): TResult {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = body();
      this.#db.exec("COMMIT");

      return result;
    }
    catch (error) {
      this.#db.exec("ROLLBACK");

      throw error;
    }
  }

  close(): void {
    if (this.#db.isOpen) {
      this.#db.close();
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }
}
