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
  describe(`${backend.name} — listFromCheckpoints scoped to one asset`, () => {
    test("returns the newest checkpoint and everything after it", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "asset.created");
      append(store, "a1", { v: 2 }, "pixelart.command");
      append(store, "a1", { v: 3 }, "asset.updated");
      append(store, "a1", { v: 4 }, "pixelart.command");

      const events = store.reader.listFromCheckpoints({
        assetId: "a1",
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 3 }, { v: 4 }]
      );
    });

    test("matches any of the given types, not only the first", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "asset.updated");
      append(store, "a1", { v: 2 }, "asset.deleted");

      const events = store.reader.listFromCheckpoints({
        assetId: "a1",
        checkpointEventTypes: ["asset.updated", "asset.deleted"]
      });

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 2 }]
      );
    });

    test("returns only that stream for an empty type list", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "asset.updated");
      append(store, "a2", { v: 2 }, "asset.updated");
      append(store, "a1", { v: 3 }, "pixelart.command");

      const events = store.reader.listFromCheckpoints({
        assetId: "a1",
        checkpointEventTypes: []
      });

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 1 }, { v: 3 }]
      );
    });

    test("returns nothing for an unknown asset", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.updated");

      assert.deepEqual(
        store.reader.listFromCheckpoints({
          assetId: "missing",
          checkpointEventTypes: ["asset.updated"]
        }),
        []
      );
    });

    test("ignores matching events on another asset stream", async() => {
      using store = await backend.create();
      append(store, "a2", { v: 1 }, "asset.updated");
      append(store, "a1", { v: 2 }, "pixelart.command");

      const events = store.reader.listFromCheckpoints({
        assetId: "a1",
        checkpointEventTypes: ["asset.updated"]
      });

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 2 }]
      );
    });
  });

  describe(`${backend.name} — listFromCheckpoints`, () => {
    test("keeps the newest checkpoint and everything after it", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "stroke");
      append(store, "a1", {}, "asset.updated");
      append(store, "a1", {}, "stroke");

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [3, 4]
      );
    });

    test("bounds each asset by its own checkpoint", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a2", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(
        events.map((event) => [event.assetId, event.eventId]),
        [["a2", 2], ["a1", 3]]
      );
    });

    test("keeps a whole stream holding no checkpoint", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "stroke");
      append(store, "a1", {}, "stroke");

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: ["asset.created"]
      });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [1, 2]
      );
    });

    test("filters by prefix without moving the checkpoint", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      append(store, "a1", {}, "stroke");

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: ["asset.updated"],
        eventTypePrefix: "asset."
      });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [2]
      );
    });

    test("matches prefix wildcards literally", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a2", {}, "a*.created");

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: [],
        eventTypePrefix: "a*."
      });

      assert.deepEqual(
        events.map((event) => event.eventType),
        ["a*.created"]
      );
    });

    test("returns every event when no checkpoint type is given", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: []
      });

      assert.deepEqual(
        events.map((event) => event.eventId),
        [1, 2, 3, 4]
      );
    });

    test("returns an empty array on an empty log", async() => {
      using store = await backend.create();

      assert.deepEqual(
        store.reader.listFromCheckpoints({
          checkpointEventTypes: ["asset.created"]
        }),
        []
      );
    });
  });
}
