// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  append,
  backends,
  seed
} from "../../helpers/backends.ts";

for (const backend of backends) {
  describe(`${backend.name} — list`, () => {
    test("returns events for the asset in version order", async() => {
      using store = await backend.create();
      append(store, "a1", { x: 1 });
      append(store, "a1", { x: 2 });
      append(store, "a2", { x: 3 });

      const events = store.reader.list("a1");

      assert.deepEqual(
        events.map((event) => event.eventVersion),
        [1, 2]
      );
    });

    test("fromVersion excludes events at or before it", async() => {
      using store = await backend.create();
      append(store, "a1", { x: 1 });
      append(store, "a1", { x: 2 });
      append(store, "a1", { x: 3 });

      const events = store.reader.list("a1", 1);

      assert.deepEqual(
        events.map((event) => event.eventVersion),
        [2, 3]
      );
    });

    test("returns an empty array for an unknown asset", async() => {
      using store = await backend.create();

      assert.deepEqual(
        store.reader.list("missing"),
        []
      );
    });

    test("hands back copies, so mutating a result cannot reach the log", async() => {
      using store = await backend.create();
      append(store, "a1", { value: 1 });

      const [event] = store.reader.list("a1");
      (event.eventData as { value: number; }).value = 999;

      assert.deepEqual(
        store.reader.list("a1")[0].eventData,
        { value: 1 }
      );
    });
  });

  describe(`${backend.name} — listAll`, () => {
    test("returns append order across interleaved streams", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll();

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
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({ fromEventId: 2 });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [3, 4]
      );
    });

    test("eventTypePrefix keeps only the matching prefix", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({
        eventTypePrefix: "asset."
      });

      assert.deepEqual(
        events.map((event) => event.eventType),
        ["asset.created", "asset.created", "asset.updated"]
      );
    });

    test("eventTypePrefix matches wildcards literally", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a2", {}, "a*.created");

      const events = store.reader.listAll({
        eventTypePrefix: "a*."
      });

      assert.deepEqual(
        events.map((event) => event.eventType),
        ["a*.created"]
      );
    });

    test("limit truncates from the start of the ordered result", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({ limit: 2 });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [1, 2]
      );
    });

    test("combines every option", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({
        fromEventId: 1,
        eventTypePrefix: "asset.",
        limit: 1
      });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [2]
      );
    });

    test("returns an empty array on an empty log", async() => {
      using store = await backend.create();

      assert.deepEqual(
        store.reader.listAll(),
        []
      );
    });
  });
}
