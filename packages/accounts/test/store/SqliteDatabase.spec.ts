// Import Node.js Dependencies
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SqliteDatabase } from "#src/store/SqliteDatabase.ts";

// CONSTANTS
const kSchema = `
  CREATE TABLE parents (id INTEGER PRIMARY KEY);
  CREATE TABLE children (parent_id INTEGER REFERENCES parents (id));
`;

interface IdRow {
  id: number;
}

interface JournalRow {
  journal_mode: string;
}

async function openWithSchema(): Promise<SqliteDatabase> {
  const db = await SqliteDatabase.open();
  db.exec(kSchema);

  return db;
}

function parentIds(
  db: SqliteDatabase
): number[] {
  return db
    .all<IdRow>("SELECT id FROM parents")
    .map((row) => row.id);
}

describe("SqliteDatabase.transaction", () => {
  test("commits and returns the body result", async() => {
    using db = await openWithSchema();

    const result = db.transaction(() => {
      db.run("INSERT INTO parents (id) VALUES (?)", 1);

      return "done";
    });

    assert.equal(result, "done");
    assert.deepEqual(parentIds(db), [1]);
  });

  test("rolls back and rethrows when the body throws", async() => {
    using db = await openWithSchema();
    const failure = new Error("boom");

    assert.throws(
      () => db.transaction(() => {
        db.run("INSERT INTO parents (id) VALUES (?)", 1);
        throw failure;
      }),
      failure
    );
    assert.equal(db.get<IdRow>("SELECT id FROM parents"), undefined);
  });
});

describe("SqliteDatabase", () => {
  test("enforces foreign keys", async() => {
    using db = await openWithSchema();

    assert.throws(
      () => db.run("INSERT INTO children (parent_id) VALUES (?)", 7),
      /FOREIGN KEY/
    );
  });

  test("closes once even when disposed after close", async() => {
    using db = await SqliteDatabase.open();

    db.close();
  });
});

describe("SqliteDatabase.open", () => {
  test("creates the directory and persists to a WAL file", async(t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sqlite-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const location = path.join(directory, "nested", "state.db");

    const written = await SqliteDatabase.open(location);
    written.exec(kSchema);
    written.run("INSERT INTO parents (id) VALUES (?)", 3);
    written.close();

    using reopened = await SqliteDatabase.open(location);
    assert.equal(
      reopened.get<JournalRow>("PRAGMA journal_mode")?.journal_mode,
      "wal"
    );
    assert.deepEqual(parentIds(reopened), [3]);
  });
});
