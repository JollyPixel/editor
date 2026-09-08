// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";
import { EventLogClosedError } from "#src/persistence/EventLog.ts";
import {
  append,
  backends
} from "../../helpers/backends.ts";

for (const backend of backends) {
  describe(`${backend.name} — close`, () => {
    test("a closed store rejects further operations", async() => {
      const store = await backend.create();
      store.close();

      assert.throws(() => append(store, "a1"));
      assert.throws(() => store.reader.list("a1"));
      assert.throws(() => store.reader.listAll());
    });

    test("reports the same failure whichever call is made", async() => {
      const store = await backend.create();
      store.close();

      assert.throws(
        () => append(store, "a1"),
        EventLogClosedError
      );
      assert.throws(
        () => store.reader.list("a1"),
        EventLogClosedError
      );
      assert.throws(
        () => store.reader.listFromCheckpoint("a1", ["asset.created"]),
        EventLogClosedError
      );
      assert.throws(
        () => store.reader.listAll(),
        EventLogClosedError
      );
      assert.throws(
        () => store.reader.listFromCheckpoints({
          checkpointEventTypes: ["asset.created"]
        }),
        EventLogClosedError
      );
      assert.throws(
        () => store.compact({ checkpointEventTypes: ["asset.created"] }),
        EventLogClosedError
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
