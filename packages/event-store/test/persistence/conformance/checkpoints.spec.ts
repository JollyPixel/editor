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
  describe(`${backend.name} — listFromCheckpoint`, () => {
    test("returns the newest checkpoint and everything after it", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "asset.created");
      append(store, "a1", { v: 2 }, "pixelart.command");
      append(store, "a1", { v: 3 }, "asset.updated");
      append(store, "a1", { v: 4 }, "pixelart.command");

      const events = store.reader.listFromCheckpoint(
        "a1",
        ["asset.created", "asset.updated"]
      );

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 3 }, { v: 4 }]
      );
    });

    test("matches any of the given types, not only the first", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "asset.updated");
      append(store, "a1", { v: 2 }, "asset.deleted");

      const events = store.reader.listFromCheckpoint(
        "a1",
        ["asset.updated", "asset.deleted"]
      );

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 2 }]
      );
    });

    test("returns the whole stream without a matching event", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "pixelart.command");
      append(store, "a1", { v: 2 }, "pixelart.command");

      const events = store.reader.listFromCheckpoint(
        "a1",
        ["asset.updated"]
      );

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 1 }, { v: 2 }]
      );
    });

    test("returns the whole stream for an empty type list", async() => {
      using store = await backend.create();
      append(store, "a1", { v: 1 }, "asset.updated");
      append(store, "a1", { v: 2 }, "pixelart.command");

      assert.deepEqual(
        store.reader
          .listFromCheckpoint("a1", [])
          .map((event) => event.eventData),
        [{ v: 1 }, { v: 2 }]
      );
    });

    test("returns nothing for an unknown asset", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.updated");

      assert.deepEqual(
        store.reader.listFromCheckpoint("missing", ["asset.updated"]),
        []
      );
    });

    test("ignores matching events on another asset stream", async() => {
      using store = await backend.create();
      append(store, "a2", { v: 1 }, "asset.updated");
      append(store, "a1", { v: 2 }, "pixelart.command");

      const events = store.reader.listFromCheckpoint(
        "a1",
        ["asset.updated"]
      );

      assert.deepEqual(
        events.map((event) => event.eventData),
        [{ v: 2 }]
      );
    });

    test("returns events the caller cannot use to mutate the log", async() => {
      using store = await backend.create();
      append(store, "a1", { nested: { value: 1 } }, "asset.created");

      const [event] = store.reader.listFromCheckpoint(
        "a1",
        ["asset.created"]
      );
      (event.eventData as { nested: { value: number; }; }).nested.value = 2;

      assert.deepEqual(
        store.reader.list("a1")[0].eventData,
        { nested: { value: 1 } }
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

    test("reads only the tail regardless of history depth", async() => {
      using store = await backend.create();
      for (let index = 0; index < 200; index++) {
        append(
          store,
          "a1",
          { index },
          "asset.updated"
        );
      }

      const events = store.reader.listFromCheckpoints({
        checkpointEventTypes: ["asset.updated"]
      });

      assert.strictEqual(events.length, 1);
      assert.deepEqual(
        events[0].eventData,
        { index: 199 }
      );
    });
  });
}
