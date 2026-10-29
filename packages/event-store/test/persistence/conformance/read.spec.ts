// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type * as EventStore from "#src/index.ts";
import {
  append,
  backends,
  seed
} from "../../helpers/backends.ts";

for (const backend of backends) {
  describe(`${backend.name} — list`, () => {
    test("returns events for the asset in version order", async() => {
      await using store = await backend.create();
      await append(store, "a1", { x: 1 });
      await append(store, "a1", { x: 2 });
      await append(store, "a2", { x: 3 });

      const events = await store.reader.list("a1");

      assert.deepEqual(
        events.map((event) => event.eventVersion),
        [1, 2]
      );
    });

    test("fromVersion excludes events at or before it", async() => {
      await using store = await backend.create();
      await append(store, "a1", { x: 1 });
      await append(store, "a1", { x: 2 });
      await append(store, "a1", { x: 3 });

      const events = await store.reader.list("a1", 1);

      assert.deepEqual(
        events.map((event) => event.eventVersion),
        [2, 3]
      );
    });

    test("returns an empty array for an unknown asset", async() => {
      await using store = await backend.create();

      assert.deepEqual(
        await store.reader.list("missing"),
        []
      );
    });
  });

  describe(`${backend.name} — get`, () => {
    test("returns the event stored at that version of the asset", async() => {
      await using store = await backend.create();
      await append(store, "a1", { x: 1 });
      const second = await append(store, "a1", { x: 2 });
      await append(store, "a2", { x: 3 });

      assert.deepEqual(await store.reader.get("a1", 2), second);
    });

    test("returns undefined for a version or asset the log does not hold", async() => {
      await using store = await backend.create();
      await append(store, "a1", { x: 1 });

      assert.strictEqual(await store.reader.get("a1", 2), undefined);
      assert.strictEqual(await store.reader.get("missing", 1), undefined);
    });
  });

  describe(`${backend.name} — read copies`, () => {
    const reads: [string, (reader: EventStore.EventReader) => Promise<EventStore.Event | undefined>][] = [
      ["get", (reader) => reader.get("a1", 1)],
      ["list", async(reader) => (await reader.list("a1"))[0]],
      ["listAll", async(reader) => (await reader.listAll())[0]],
      [
        "listFromCheckpoints",
        async(reader) => (await reader.listFromCheckpoints({
          checkpointEventTypes: ["asset.created"]
        }))[0]
      ]
    ];

    for (const [name, read] of reads) {
      test(`${name} hands back copies, so mutating a result cannot reach the log`, async() => {
        await using store = await backend.create();
        await append(store, "a1", { nested: { value: 1 } }, "asset.created");

        const event = await read(store.reader);
        assert.ok(event);
        (event.eventData as { nested: { value: number; }; }).nested.value = 999;

        assert.deepEqual(
          (await read(store.reader))?.eventData,
          { nested: { value: 1 } }
        );
      });
    }
  });

  describe(`${backend.name} — listAll`, () => {
    test("returns append order across interleaved streams", async() => {
      await using store = await backend.create();
      await seed(store);

      const events = await store.reader.listAll();

      assert.deepEqual(
        events.map((event) => event.eventId),
        [1, 2, 3, 4]
      );
      assert.deepEqual(
        events.map((event) => event.assetId),
        ["a1", "a2", "a1", "a2"]
      );
    });

    test("fromEventId is an exclusive lower bound", async() => {
      await using store = await backend.create();
      await seed(store);

      const events = await store.reader.listAll({ fromEventId: 2 });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [3, 4]
      );
    });

    test("eventTypePrefix keeps only the matching prefix", async() => {
      await using store = await backend.create();
      await seed(store);

      const events = await store.reader.listAll({
        eventTypePrefix: "asset."
      });

      assert.deepEqual(
        events.map((event) => event.eventType),
        ["asset.created", "asset.created", "asset.updated"]
      );
    });

    test("eventTypePrefix matches wildcards literally", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a2", {}, "a*.created");

      const events = await store.reader.listAll({
        eventTypePrefix: "a*."
      });

      assert.deepEqual(
        events.map((event) => event.eventType),
        ["a*.created"]
      );
    });

    test("limit truncates from the start of the ordered result", async() => {
      await using store = await backend.create();
      await seed(store);

      const events = await store.reader.listAll({ limit: 2 });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [1, 2]
      );
    });

    test("combines every option", async() => {
      await using store = await backend.create();
      await seed(store);

      const events = await store.reader.listAll({
        fromEventId: 1,
        eventTypePrefix: "asset.",
        limit: 1
      });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [2]
      );
    });

    test("newestFirst pages backwards from beforeEventId", async() => {
      await using store = await backend.create();
      await seed(store);

      const first = await store.reader.listAll({
        newestFirst: true,
        limit: 2
      });
      const next = await store.reader.listAll({
        newestFirst: true,
        beforeEventId: first.at(-1)?.eventId,
        limit: 2
      });

      assert.deepEqual(
        [...first, ...next].map((event) => event.eventId),
        [4, 3, 2, 1]
      );
    });

    test("returns an empty array on an empty log", async() => {
      await using store = await backend.create();

      assert.deepEqual(
        await store.reader.listAll(),
        []
      );
    });
  });
}
