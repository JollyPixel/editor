// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { SqliteDatabase } from "./SqliteDatabase.ts";

// CONSTANTS
const kOverridesSchema = z.record(z.string(), z.unknown());

export type PreferenceOverrides = Readonly<Record<string, unknown>>;

interface PreferenceRow {
  scope: string;
  overrides: string;
}

export class PreferenceRepository {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  replace(
    accountId: string,
    scope: string,
    overrides: PreferenceOverrides
  ): void {
    if (Object.keys(overrides).length === 0) {
      this.#db.run(
        "DELETE FROM preferences WHERE user_id = ? AND scope = ?",
        accountId,
        scope
      );

      return;
    }

    this.#db.run(
      `INSERT INTO preferences (user_id, scope, overrides) VALUES (?, ?, ?)
       ON CONFLICT (user_id, scope) DO UPDATE SET overrides = excluded.overrides`,
      accountId,
      scope,
      JSON.stringify(overrides)
    );
  }

  findAll(
    accountId: string
  ): Map<string, PreferenceOverrides> {
    const rows = this.#db.all<PreferenceRow>(
      "SELECT scope, overrides FROM preferences WHERE user_id = ? ORDER BY scope",
      accountId
    );

    return new Map(rows.map((row) => [
      row.scope,
      kOverridesSchema.parse(JSON.parse(row.overrides))
    ]));
  }
}
