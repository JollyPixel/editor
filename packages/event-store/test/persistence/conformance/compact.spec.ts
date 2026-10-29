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
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "stroke");
      await append(store, "a1", {}, "asset.updated");
      await append(store, "a1", {}, "stroke");

      const report = await store.compact({
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(report, { removed: 2, assets: 1 });
      assert.deepEqual(
        (await store.reader.list("a1")).map((event) => event.eventId),
        [3, 4]
      );
    });

    test("preserves the event ids and versions of the survivors", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");

      await store.compact({ checkpointEventTypes: ["asset.updated"] });

      const [event] = await store.reader.list("a1");
      assert.strictEqual(event.eventId, 2);
      assert.strictEqual(event.eventVersion, 2);
    });

    test("keeps assigning increasing versions after a compaction", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      await store.compact({ checkpointEventTypes: ["asset.updated"] });

      const event = await append(store, "a1", {}, "stroke");

      assert.strictEqual(event.eventVersion, 3);
    });

    test("leaves a stream holding no checkpoint untouched", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "stroke");
      await append(store, "a1", {}, "stroke");

      const report = await store.compact({
        checkpointEventTypes: ["asset.created"]
      });

      assert.deepEqual(report, { removed: 0, assets: 0 });
      assert.strictEqual((await store.reader.list("a1")).length, 2);
    });

    test("compacts each asset independently", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      await append(store, "a2", {}, "asset.created");

      const report = await store.compact({
        checkpointEventTypes: ["asset.created", "asset.updated"]
      });

      assert.deepEqual(report, { removed: 1, assets: 2 });
      assert.strictEqual((await store.reader.list("a2")).length, 1);
    });

    test("is idempotent", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      const options = { checkpointEventTypes: ["asset.updated"] };

      await store.compact(options);

      assert.strictEqual((await store.compact(options)).removed, 0);
    });

    test("removes nothing when no checkpoint type is given", async() => {
      await using store = await backend.create();
      await seed(store);

      const report = await store.compact({ checkpointEventTypes: [] });

      assert.deepEqual(report, { removed: 0, assets: 0 });
      assert.strictEqual((await store.reader.listAll()).length, 4);
    });

    test("compacts only the given asset", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      await append(store, "a2", {}, "asset.created");
      await append(store, "a2", {}, "asset.updated");

      const report = await store.compact({
        checkpointEventTypes: ["asset.created", "asset.updated"],
        assetId: "a1"
      });

      assert.deepEqual(report, { removed: 1, assets: 1 });
      assert.strictEqual((await store.reader.list("a1")).length, 1);
      assert.strictEqual((await store.reader.list("a2")).length, 2);
    });

    test("keeps the positions it is given, in their own asset only", async() => {
      await using store = await backend.create();
      for (const assetId of ["a1", "a2"]) {
        await append(store, assetId, {}, "asset.created");
        await append(store, assetId, {}, "stroke");
        await append(store, assetId, {}, "asset.updated");
      }

      const report = await store.compact({
        ...kCheckpoints,
        keep: [{ assetId: "a1", eventVersion: 1 }]
      });

      assert.deepEqual(report, { removed: 3, assets: 2 });
      assert.deepEqual(
        (await store.reader.list("a1")).map((event) => event.eventVersion),
        [1, 3]
      );
      assert.deepEqual(
        (await store.reader.list("a2")).map((event) => event.eventVersion),
        [3]
      );
    });

    test("keeps a tagged event while checkpoint reads skip it", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "stroke");
      await append(store, "a1", {}, "asset.updated");
      await append(store, "a1", {}, "stroke");
      await tag(store, "a1", "v1");

      const report = await store.compact(kCheckpoints);

      assert.deepEqual(report, { removed: 1, assets: 1 });
      assert.deepEqual(
        (await store.reader.list("a1")).map((event) => event.eventVersion),
        [1, 3, 4]
      );
      assert.deepEqual(
        (await store.reader.listFromCheckpoints({
          ...kCheckpoints,
          assetId: "a1"
        })).map((event) => event.eventVersion),
        [3, 4]
      );
    });

    test("removes a tagged event once its last tag is deleted", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      await tag(store, "a1", "v1");
      await tag(store, "a1", "first");

      await store.tags.delete("a1", "v1");
      const kept = await store.compact(kCheckpoints);
      await store.tags.delete("a1", "first");
      const removed = await store.compact(kCheckpoints);

      assert.strictEqual(kept.removed, 0);
      assert.strictEqual(removed.removed, 1);
      assert.deepEqual(
        (await store.reader.list("a1")).map((event) => event.eventVersion),
        [2]
      );
    });
  });
}
