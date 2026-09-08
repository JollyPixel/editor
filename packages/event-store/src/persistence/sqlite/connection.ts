// Import Node.js Dependencies
import type {
  DatabaseSync,
  SQLInputValue,
  StatementSync
} from "node:sqlite";

/**
 * A database handle that caches every statement it prepares, keyed by SQL.
 * Statements live as long as the connection and are dropped on `close()`.
 */
export class SqliteConnection {
  #db: DatabaseSync;
  #statements = new Map<string, StatementSync>();
  #closed = false;

  constructor(
    db: DatabaseSync
  ) {
    this.#db = db;
  }

  get closed(): boolean {
    return this.#closed;
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

  exec(
    sql: string
  ): void {
    this.#db.exec(sql);
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
    let statement = this.#statements.get(sql);
    if (statement === undefined) {
      statement = this.#db.prepare(sql);
      this.#statements.set(sql, statement);
    }

    return statement;
  }
}
