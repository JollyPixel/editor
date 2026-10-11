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
    test("append returns the closed failure the reads and compact throw", async() => {
      const store = await backend.create();
      store.close();

      const result = store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: {},
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.ok(result.val instanceof EventStore.EventLogClosedError);
      assert.throws(
        () => store.reader.list("a1"),
        EventStore.EventLogClosedError
      );
      assert.throws(
        () => store.reader.listAll(),
        EventStore.EventLogClosedError
      );
      assert.throws(
        () => store.reader.listFromCheckpoints({
          checkpointEventTypes: ["asset.created"]
        }),
        EventStore.EventLogClosedError
      );
      assert.throws(
        () => store.compact({ checkpointEventTypes: ["asset.created"] }),
        EventStore.EventLogClosedError
      );
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
