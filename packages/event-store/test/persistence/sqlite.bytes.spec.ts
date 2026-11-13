// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";
import { append } from "../helpers/backends.ts";

describe("SqliteEventStore — bytes", () => {
  test("stores Uint8Array eventData raw in the event_bytes column", async(t) => {
    const file = databaseFile(t);
    const store = await EventStore.persistence.sqlite(file);
    await append(store, "a1", {
      pixels: new Uint8Array([0, 1]),
      heights: new Uint8Array([254, 255])
    });
    await store.close();

    using db = new DatabaseSync(file);
    const row = db.prepare("SELECT event_data, event_bytes FROM events").get();
    assert.deepEqual(
      JSON.parse(String(row?.event_data)),
      {
        pixels: { $bytes: [0, 2] },
        heights: { $bytes: [2, 2] }
      }
    );
    assert.deepEqual(row?.event_bytes, new Uint8Array([0, 1, 254, 255]));
  });

  test("reading fails when event_bytes no longer holds a stored range", async(t) => {
    const file = databaseFile(t);
    const store = await EventStore.persistence.sqlite(file);
    await append(store, "a1", { pixels: new Uint8Array([0, 1, 2]) });
    await store.close();

    const db = new DatabaseSync(file);
    db.prepare("UPDATE events SET event_bytes = ?").run(new Uint8Array([0]));
    db.close();

    await using reopened = await EventStore.persistence.sqlite(file);
    await assert.rejects(reopened.reader.list("a1"), RangeError);
  });

  test("a file made before event_bytes gains the column on open", async(t) => {
    const file = databaseFile(t);
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
      VALUES ('texture', 'a1', 'pixel-set', '{"x":1}', 1, '{}', 'now');
    `);
    legacy.close();

    await using store = await EventStore.persistence.sqlite(file);
    await append(store, "a1", { pixels: new Uint8Array([7]) });

    assert.deepEqual(
      (await store.reader.list("a1")).map((event) => event.eventData),
      [
        { x: 1 },
        { pixels: new Uint8Array([7]) }
      ]
    );
  });

  function databaseFile(
    t: TestContext
  ): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "event-store-bytes-"));
    t.after(
      () => fs.rmSync(root, { force: true, recursive: true })
    );

    return path.join(root, "events.db");
  }
});
