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
  backends,
  tag,
  USER_ACTOR
} from "../../helpers/backends.ts";

for (const backend of backends) {
  describe(`${backend.name} — tags`, () => {
    test("create returns the tag that get and list hand back", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");

      const created = (await store.tags.create({
        assetId: "a1",
        name: "v1",
        eventVersion: 1,
        message: "First pass",
        actor: USER_ACTOR
      })).unwrap();

      assert.deepEqual(
        { ...created, createdAt: typeof created.createdAt },
        {
          assetId: "a1",
          name: "v1",
          eventVersion: 1,
          message: "First pass",
          actor: USER_ACTOR,
          createdAt: "string"
        }
      );
      assert.deepEqual(await store.tags.get("a1", "v1"), created);
      assert.deepEqual(await store.tags.list("a1"), [created]);
    });

    test("list returns tags in creation order, for every asset or one", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a2", {}, "asset.created");
      await tag(store, "a1", "b");
      await tag(store, "a2", "x");
      await tag(store, "a1", "a");

      assert.deepEqual(
        (await store.tags.list()).map(({ assetId, name }) => `${assetId}:${name}`),
        ["a1:b", "a2:x", "a1:a"]
      );
      assert.deepEqual(
        (await store.tags.list("a1")).map(({ name }) => name),
        ["b", "a"]
      );
    });

    test("one event may carry several names", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");

      const first = await tag(store, "a1", "v1");
      const second = await tag(store, "a1", "release");

      assert.deepEqual(await store.tags.list("a1"), [first, second]);
    });

    test("the same name may tag events of different assets", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a2", {}, "asset.created");
      await tag(store, "a1", "v1");

      const result = await store.tags.create({
        assetId: "a2",
        name: "v1",
        eventVersion: 1,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, true);
    });

    test("create refuses a name the asset already uses", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      await tag(store, "a1", "v1");

      const result = await store.tags.create({
        assetId: "a1",
        name: "v1",
        eventVersion: 2,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof EventStore.EventTagConflictError);
      assert.strictEqual((await store.tags.get("a1", "v1"))?.eventVersion, 1);
    });

    test("create refuses a version the stream does not hold", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");

      const results = [
        await store.tags.create({
          assetId: "a1",
          name: "v2",
          eventVersion: 2,
          actor: USER_ACTOR
        }),
        await store.tags.create({
          assetId: "missing",
          name: "v1",
          eventVersion: 1,
          actor: USER_ACTOR
        })
      ];

      for (const result of results) {
        assert.strictEqual(result.ok, false);
        assert.ok(result.val instanceof EventStore.UnknownEventError);
      }
      assert.deepEqual(await store.tags.list(), []);
    });

    test("create refuses a version compaction removed", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "asset.updated");
      await store.compact({ checkpointEventTypes: ["asset.updated"] });

      const result = await store.tags.create({
        assetId: "a1",
        name: "v1",
        eventVersion: 1,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof EventStore.UnknownEventError);
    });

    test("create refuses an empty name", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");

      const result = await store.tags.create({
        assetId: "a1",
        name: "",
        eventVersion: 1,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof TypeError);
    });

    test("delete removes the tag once", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await tag(store, "a1", "v1");

      assert.strictEqual(await store.tags.delete("a1", "v1"), true);
      assert.strictEqual(await store.tags.delete("a1", "v1"), false);
      assert.strictEqual(await store.tags.get("a1", "v1"), undefined);
      assert.strictEqual((await store.reader.list("a1")).length, 1);
    });

    test("reads hand back copies, so mutating a tag cannot reach the log", async() => {
      await using store = await backend.create();
      await append(store, "a1", {}, "asset.created");
      await tag(store, "a1", "v1");

      const found = await store.tags.get("a1", "v1");
      assert.ok(found?.actor.type === "user");
      found.actor.id = "mallory";

      assert.deepEqual((await store.tags.list("a1"))[0].actor, USER_ACTOR);
    });
  });
}
