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
import { createSqliteEventStore } from "#src/node.ts";
import { SQL_SCHEMA } from "#src/persistence/sqlite/schema.ts";
import {
  append,
  tag
} from "../helpers/backends.ts";

describe("SqliteEventStore — durability", () => {
  test("data survives across instances backed by the same file", async(t) => {
    const file = path.join(
      os.tmpdir(),
      `event-store-${process.pid}-${Date.now()}.sqlite`
    );
    t.after(
      () => fs.rmSync(file, { force: true })
    );

    await using first = await EventStore.persistence.sqlite(file);
    await append(
      first,
      "a1",
      { x: 1 }
    );
    await first.close();

    await using second = await EventStore.persistence.sqlite(file);

    assert.deepEqual(
      (await second.reader.list("a1")).map((event) => event.eventData),
      [{ x: 1 }]
    );
  });
});

describe("SqliteEventStore — location", () => {
  test("creates the directories its file lives in", async(t) => {
    const root = path.join(
      os.tmpdir(),
      `event-store-${process.pid}-${Date.now()}-nested`
    );
    t.after(
      () => fs.rmSync(root, { force: true, recursive: true })
    );

    const file = path.join(root, ".state", "events.db");
    await using store = await EventStore.persistence.sqlite(file);
    await append(store, "a1", { x: 1 });

    assert.strictEqual(fs.statSync(file).isFile(), true);
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
    t.after(
      () => fs.rmSync(file, { force: true })
    );

    await using first = await EventStore.persistence.sqlite(file);
    await using second = await EventStore.persistence.sqlite(file);

    await append(first, "a1", { writer: "first" });
    await append(second, "a1", { writer: "second" });

    assert.deepEqual(
      (await first.reader.list("a1")).map((event) => event.eventVersion),
      [1, 2]
    );
  });
});

describe("SqliteEventStore — journal", () => {
  test("opens a file in WAL mode with incremental vacuum", async(t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "event-store-wal-"));
    t.after(
      () => fs.rmSync(root, { force: true, recursive: true })
    );

    const file = path.join(root, "events.db");
    const store = await EventStore.persistence.sqlite(file);
    await store.close();

    using db = new DatabaseSync(file);
    assert.deepEqual(
      { ...db.prepare("PRAGMA journal_mode").get() },
      { journal_mode: "wal" }
    );
    assert.deepEqual(
      { ...db.prepare("PRAGMA auto_vacuum").get() },
      { auto_vacuum: 2 }
    );
  });

  test("converts an existing file to incremental vacuum", async(t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "event-store-wal-"));
    t.after(
      () => fs.rmSync(root, { force: true, recursive: true })
    );

    const file = path.join(root, "events.db");
    const legacy = new DatabaseSync(file);
    legacy.exec(SQL_SCHEMA);
    legacy.close();

    await using store = await EventStore.persistence.sqlite(file);
    await append(store, "a1", { x: 1 });
    await store.close();

    using db = new DatabaseSync(file);
    assert.deepEqual(
      { ...db.prepare("PRAGMA auto_vacuum").get() },
      { auto_vacuum: 2 }
    );
  });

  test("reclaims compacted pages without a full vacuum", async(t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "event-store-wal-"));
    t.after(
      () => fs.rmSync(root, { force: true, recursive: true })
    );

    const file = path.join(root, "events.db");
    await using store = await EventStore.persistence.sqlite(file);
    const payload = { blob: "x".repeat(64 * 1024) };
    await append(store, "a1", payload, "asset.created");
    await append(store, "a1", payload, "asset.updated");

    const report = await store.compact({
      checkpointEventTypes: ["asset.created", "asset.updated"]
    });

    using db = new DatabaseSync(file);
    assert.strictEqual(report.removed, 1);
    assert.deepEqual(
      { ...db.prepare("PRAGMA freelist_count").get() },
      { freelist_count: 0 }
    );
  });
});

describe("SqliteEventStore — tags", () => {
  test("a file made before tags gains the table and keeps tags across instances", async(t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "event-store-tags-"));
    t.after(
      () => fs.rmSync(root, { force: true, recursive: true })
    );

    const file = path.join(root, "events.db");
    const legacy = new DatabaseSync(file);
    legacy.exec(`
      CREATE TABLE events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_type TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        event_version INTEGER NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (asset_id, event_version)
      );
      INSERT INTO events (asset_type, asset_id, event_type, event_data,
        event_version, actor, created_at)
      VALUES ('texture', 'a1', 'asset.created', '{}', 1, '{}', 'now');
    `);
    legacy.close();

    const first = await EventStore.persistence.sqlite(file);
    const created = await tag(first, "a1", "v1");
    await first.close();

    await using second = await EventStore.persistence.sqlite(file);

    assert.deepEqual(await second.tags.list(), [created]);
  });
});

describe("SqliteEventStore — subpath entrypoint", () => {
  test("exposes the same factory as persistence.sqlite", async() => {
    await using store = await createSqliteEventStore();

    const event = await append(
      store,
      "a1",
      { x: 1 }
    );

    assert.strictEqual(
      event.eventVersion,
      1
    );
  });
});
