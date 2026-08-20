// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";
import {
  createSqliteEventStore,
  SQL_SCHEMA
} from "#src/persistence/sqlite/index.ts";
import { append } from "../helpers/backends.ts";

/**
 * Everything the shared conformance suite cannot express, because it only
 * holds for the persistent backend.
 */
describe("SqliteEventStore — durability", () => {
  test("data survives across instances backed by the same file", async(t) => {
    const file = path.join(
      os.tmpdir(),
      `event-store-${process.pid}-${Date.now()}.sqlite`
    );
    t.after(() => fs.rmSync(file, { force: true }));

    using first = await EventStore.persistence.sqlite(file);
    append(first, "a1", { x: 1 });
    first.close();

    using second = await EventStore.persistence.sqlite(file);

    assert.deepEqual(
      second.reader.list("a1").map((event) => event.eventData),
      [{ x: 1 }]
    );
  });
});

describe("SqliteEventStore — version invariant", () => {
  test("the schema rejects a duplicate version for one asset", () => {
    using db = new DatabaseSync(":memory:");
    db.exec(SQL_SCHEMA);
    const insert = db.prepare(
      `INSERT INTO events (asset_type, asset_id, event_type, event_data,
        event_version, actor, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    insert.run("texture", "a1", "pixel-set", "{}", 1, "{}", "now");

    assert.throws(
      () => insert.run("texture", "a1", "pixel-set", "{}", 1, "{}", "now"),
      /UNIQUE constraint failed/
    );
  });

  test("two connections on one file keep versions unique", async(t) => {
    const file = path.join(
      os.tmpdir(),
      `event-store-race-${process.pid}-${Date.now()}.sqlite`
    );
    t.after(() => fs.rmSync(file, { force: true }));

    using first = await EventStore.persistence.sqlite(file);
    using second = await EventStore.persistence.sqlite(file);

    append(first, "a1", { writer: "first" });
    append(second, "a1", { writer: "second" });

    assert.deepEqual(
      first.reader.list("a1").map((event) => event.eventVersion),
      [1, 2]
    );
  });
});

describe("SqliteEventStore — subpath entrypoint", () => {
  test("exposes the same factory as persistence.sqlite", async() => {
    using store = await createSqliteEventStore();

    const event = append(store, "a1", { x: 1 });

    assert.strictEqual(event.eventVersion, 1);
  });
});
