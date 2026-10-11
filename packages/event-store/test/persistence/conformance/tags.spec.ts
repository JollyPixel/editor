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
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");

      const created = store.tags.create({
        assetId: "a1",
        name: "v1",
        eventVersion: 1,
        message: "First pass",
        actor: USER_ACTOR
      }).unwrap();

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
      assert.deepEqual(store.tags.get("a1", "v1"), created);
      assert.deepEqual(store.tags.list("a1"), [created]);
    });

    test("list returns tags in creation order, for every asset or one", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a2", {}, "asset.created");
      tag(store, "a1", "b");
      tag(store, "a2", "x");
      tag(store, "a1", "a");

      assert.deepEqual(
        store.tags.list().map(({ assetId, name }) => `${assetId}:${name}`),
        ["a1:b", "a2:x", "a1:a"]
      );
      assert.deepEqual(
        store.tags.list("a1").map(({ name }) => name),
        ["b", "a"]
      );
    });

    test("one event may carry several names", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");

      const first = tag(store, "a1", "v1");
      const second = tag(store, "a1", "release");

      assert.deepEqual(store.tags.list("a1"), [first, second]);
    });

    test("the same name may tag events of different assets", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a2", {}, "asset.created");
      tag(store, "a1", "v1");

      const result = store.tags.create({
        assetId: "a2",
        name: "v1",
        eventVersion: 1,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, true);
    });

    test("create refuses a name the asset already uses", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      tag(store, "a1", "v1");

      const result = store.tags.create({
        assetId: "a1",
        name: "v1",
        eventVersion: 2,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof EventStore.EventTagConflictError);
      assert.strictEqual(store.tags.get("a1", "v1")?.eventVersion, 1);
    });

    test("create refuses a version the stream does not hold", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");

      const results = [
        store.tags.create({
          assetId: "a1",
          name: "v2",
          eventVersion: 2,
          actor: USER_ACTOR
        }),
        store.tags.create({
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
      assert.deepEqual(store.tags.list(), []);
    });

    test("create refuses a version compaction removed", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "asset.updated");
      store.compact({ checkpointEventTypes: ["asset.updated"] });

      const result = store.tags.create({
        assetId: "a1",
        name: "v1",
        eventVersion: 1,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof EventStore.UnknownEventError);
    });

    test("create refuses an empty name", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");

      const result = store.tags.create({
        assetId: "a1",
        name: "",
        eventVersion: 1,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof TypeError);
    });

    test("delete removes the tag once", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      tag(store, "a1", "v1");

      assert.strictEqual(store.tags.delete("a1", "v1"), true);
      assert.strictEqual(store.tags.delete("a1", "v1"), false);
      assert.strictEqual(store.tags.get("a1", "v1"), undefined);
      assert.strictEqual(store.reader.list("a1").length, 1);
    });

    test("reads hand back copies, so mutating a tag cannot reach the log", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      tag(store, "a1", "v1");

      const found = store.tags.get("a1", "v1");
      assert.ok(found?.actor.type === "user");
      found.actor.id = "mallory";

      assert.deepEqual(store.tags.list("a1")[0].actor, USER_ACTOR);
    });
  });
}
