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
  USER_ACTOR
} from "../../helpers/backends.ts";

for (const backend of backends) {
  describe(`${backend.name} — close`, () => {
    test("append and tag creation return the closed failure every other member throws", async() => {
      const store = await backend.create();
      store.close();

      const results = [
        store.writer.append({
          assetType: "texture",
          assetId: "a1",
          eventType: "pixel-set",
          eventData: {},
          actor: USER_ACTOR
        }),
        store.tags.create({
          assetId: "a1",
          name: "v1",
          eventVersion: 1,
          actor: USER_ACTOR
        })
      ];
      const members = [
        () => store.reader.get("a1", 1),
        () => store.reader.list("a1"),
        () => store.reader.listAll(),
        () => store.reader.listFromCheckpoints({
          checkpointEventTypes: ["asset.created"]
        }),
        () => store.compact({ checkpointEventTypes: ["asset.created"] }),
        () => store.tags.get("a1", "v1"),
        () => store.tags.list(),
        () => store.tags.delete("a1", "v1")
      ];

      for (const result of results) {
        assert.strictEqual(result.ok, false);
        assert.ok(result.val instanceof EventStore.EventLogClosedError);
      }
      for (const member of members) {
        assert.throws(member, EventStore.EventLogClosedError);
      }
    });

    test("close is idempotent", async() => {
      const store = await backend.create();
      store.close();

      assert.doesNotThrow(() => store.close());
    });

    test("using closes the store on scope exit", async() => {
      let escaped: EventStore.EventStore;

      {
        using store = await backend.create();
        append(store, "a1", { x: 1 });
        escaped = store;
      }

      assert.throws(() => escaped.reader.list("a1"));
    });
  });
}
