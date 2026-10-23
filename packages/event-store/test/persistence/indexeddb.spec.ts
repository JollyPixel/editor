// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";
import {
  append,
  tag,
  USER_ACTOR
} from "../helpers/backends.ts";

function open(
  name: string
): Promise<EventStore.EventStore> {
  return EventStore.persistence.indexeddb({ name });
}

describe("IndexedDbEventStore — durability", () => {
  test("an append reaches a second connection before the first one closes", async() => {
    const name = crypto.randomUUID();
    using first = await open(name);
    append(first, "a1", { x: 1 });

    using second = await open(name);

    assert.deepEqual(
      second.reader.list("a1").map((event) => event.eventData),
      [{ x: 1 }]
    );
  });

  test("a reopened store keeps tags and continues ids and versions", async() => {
    const name = crypto.randomUUID();
    const first = await open(name);
    append(first, "a1", { x: 1 });
    append(first, "a2", { x: 2 });
    const created = tag(first, "a1", "v1");
    first.close();

    using second = await open(name);
    const next = append(second, "a1", { x: 3 });

    assert.deepEqual(second.tags.list(), [created]);
    assert.deepEqual(
      {
        eventId: next.eventId,
        eventVersion: next.eventVersion
      },
      {
        eventId: 3,
        eventVersion: 2
      }
    );
    assert.deepEqual(
      second.reader.listAll().map((event) => event.eventData),
      [{ x: 1 }, { x: 2 }, { x: 3 }]
    );
  });

  test("a deleted tag stays deleted after a reopen", async() => {
    const name = crypto.randomUUID();
    const first = await open(name);
    append(first, "a1");
    tag(first, "a1", "v1");
    first.tags.delete("a1", "v1");
    first.close();

    using second = await open(name);

    assert.deepEqual(second.tags.list(), []);
  });

  test("compaction removes the superseded events from the database", async() => {
    const name = crypto.randomUUID();
    const first = await open(name);
    append(first, "a1", { revision: 1 }, "asset.created");
    append(first, "a1", { x: 1 });
    append(first, "a1", { revision: 2 }, "asset.updated");
    first.compact({
      checkpointEventTypes: ["asset.created", "asset.updated"]
    });
    first.close();

    using second = await open(name);

    assert.deepEqual(
      second.reader.list("a1").map((event) => event.eventVersion),
      [3]
    );
  });
});

describe("IndexedDbEventStore — deletion elsewhere", () => {
  test("an append fails once another connection deletes the database", async() => {
    const name = crypto.randomUUID();
    using store = await open(name);
    append(store, "a1", { x: 1 });

    await EventStore.persistence.indexeddb.destroy({ name });
    const result = store.writer.append({
      assetType: "texture",
      assetId: "a1",
      eventType: "pixel-set",
      eventData: { x: 2 },
      actor: USER_ACTOR
    });

    assert.strictEqual(result.err, true);
    assert.deepEqual(
      store.reader.list("a1").map((event) => event.eventData),
      [{ x: 1 }]
    );
  });
});
