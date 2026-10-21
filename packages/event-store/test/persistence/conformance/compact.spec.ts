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
  seed,
  tag
} from "../../helpers/backends.ts";

// CONSTANTS
const kCheckpoints = {
  checkpointEventTypes: ["asset.created", "asset.updated"]
};

for (const backend of backends) {
  describe(`${backend.name} — compact`, () => {
    test("removes the events superseded by each checkpoint", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "stroke");
      append(store, "a1", {}, "asset.updated");
      append(store, "a1", {}, "stroke");

      const report = store.compact({
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(report, { removed: 2, assets: 1 });
      assert.deepEqual(
        store.reader.list("a1").map((event) => event.eventId),
        [3, 4]
      );
    });

    test("preserves the event ids and versions of the survivors", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");

      store.compact({ checkpointEventTypes: ["asset.updated"] });

      const [event] = store.reader.list("a1");
      assert.strictEqual(event.eventId, 2);
      assert.strictEqual(event.eventVersion, 2);
    });

    test("keeps assigning increasing versions after a compaction", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      store.compact({ checkpointEventTypes: ["asset.updated"] });

      const event = append(store, "a1", {}, "stroke");

      assert.strictEqual(event.eventVersion, 3);
    });

    test("leaves a stream holding no checkpoint untouched", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "stroke");
      append(store, "a1", {}, "stroke");

      const report = store.compact({
        checkpointEventTypes: ["asset.created"]
      });

      assert.deepEqual(report, { removed: 0, assets: 0 });
      assert.strictEqual(store.reader.list("a1").length, 2);
    });

    test("compacts each asset independently", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      append(store, "a2", {}, "asset.created");

      const report = store.compact({
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(report, { removed: 1, assets: 2 });
      assert.strictEqual(store.reader.list("a2").length, 1);
    });

    test("is idempotent", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      const options = { checkpointEventTypes: ["asset.updated"] };

      store.compact(options);

      assert.strictEqual(store.compact(options).removed, 0);
    });

    test("removes nothing when no checkpoint type is given", async() => {
      using store = await backend.create();
      seed(store);

      const report = store.compact({ checkpointEventTypes: [] });

      assert.deepEqual(report, { removed: 0, assets: 0 });
      assert.strictEqual(store.reader.listAll().length, 4);
    });

    test("compacts only the given asset", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      append(store, "a2", {}, "asset.created");
      append(store, "a2", {}, "asset.updated");

      const report = store.compact({
        checkpointEventTypes: ["asset.created", "asset.updated"],
        assetId: "a1"
      });

      assert.deepEqual(report, { removed: 1, assets: 1 });
      assert.strictEqual(store.reader.list("a1").length, 1);
      assert.strictEqual(store.reader.list("a2").length, 2);
    });

    test("keeps the positions it is given, in their own asset only", async() => {
      using store = await backend.create();
      for (const assetId of ["a1", "a2"]) {
        append(store, assetId, {}, "asset.created");
        append(store, assetId, {}, "stroke");
        append(store, assetId, {}, "asset.updated");
      }

      const report = store.compact({
        ...kCheckpoints,
        keep: [{ assetId: "a1", eventVersion: 1 }]
      });

      assert.deepEqual(report, { removed: 3, assets: 2 });
      assert.deepEqual(
        store.reader.list("a1").map((event) => event.eventVersion),
        [1, 3]
      );
      assert.deepEqual(
        store.reader.list("a2").map((event) => event.eventVersion),
        [3]
      );
    });

    test("keeps a tagged event while checkpoint reads skip it", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "stroke");
      append(store, "a1", {}, "asset.updated");
      append(store, "a1", {}, "stroke");
      tag(store, "a1", "v1");

      const report = store.compact(kCheckpoints);

      assert.deepEqual(report, { removed: 1, assets: 1 });
      assert.deepEqual(
        store.reader.list("a1").map((event) => event.eventVersion),
        [1, 3, 4]
      );
      assert.deepEqual(
        store.reader.listFromCheckpoints({
          ...kCheckpoints,
          assetId: "a1"
        }).map((event) => event.eventVersion),
        [3, 4]
      );
    });

    test("removes a tagged event once its last tag is deleted", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      tag(store, "a1", "v1");
      tag(store, "a1", "first");

      store.tags.delete("a1", "v1");
      const kept = store.compact(kCheckpoints);
      store.tags.delete("a1", "first");
      const removed = store.compact(kCheckpoints);

      assert.strictEqual(kept.removed, 0);
      assert.strictEqual(removed.removed, 1);
      assert.deepEqual(
        store.reader.list("a1").map((event) => event.eventVersion),
        [2]
      );
    });
  });
}
