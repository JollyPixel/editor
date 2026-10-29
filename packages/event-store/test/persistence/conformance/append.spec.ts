// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EventVersionConflictError } from "#src/index.ts";
import {
  append,
  backends,
  SYSTEM_ACTOR,
  USER_ACTOR,
  seed
} from "../../helpers/backends.ts";

for (const backend of backends) {
  describe(`${backend.name} — append`, () => {
    test("assigns a monotonically increasing version per asset", async() => {
      await using store = await backend.create();

      const first = await append(store, "a1", { x: 1 });
      const second = await append(store, "a1", { x: 2 });

      assert.strictEqual(first.eventVersion, 1);
      assert.strictEqual(second.eventVersion, 2);
    });

    test("tracks versions independently per asset", async() => {
      await using store = await backend.create();

      await append(store, "a1");
      const event = await append(store, "a2");

      assert.strictEqual(event.eventVersion, 1);
    });

    test("returns the event exactly as list serves it back", async() => {
      await using store = await backend.create();

      const appended = await append(
        store,
        "a1",
        { nested: { value: 1 } }
      );
      const [read] = await store.reader.list("a1");

      assert.deepEqual(appended, read);
    });

    test("does not alias the eventData it was given", async() => {
      await using store = await backend.create();
      const eventData = {
        nested: {
          value: 1
        }
      };

      const event = await append(
        store,
        "a1",
        eventData
      );
      eventData.nested.value = 999;

      assert.deepEqual(
        event.eventData,
        { nested: { value: 1 } }
      );
      assert.deepEqual(
        (await store.reader.list("a1"))[0].eventData,
        { nested: { value: 1 } }
      );
    });

    test("round-trips eventData through JSON", async() => {
      await using store = await backend.create();

      const event = await append(store, "a1", {
        when: new Date(0),
        missing: undefined,
        nested: { value: 1 }
      });

      assert.deepEqual(event.eventData, {
        when: "1970-01-01T00:00:00.000Z",
        nested: { value: 1 }
      });
    });

    test("rejects eventData JSON cannot represent", async() => {
      await using store = await backend.create();

      const result = await store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: 1n,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
    });

    test("a rejected append burns neither an eventId nor a version", async() => {
      await using store = await backend.create();

      const rejected = await store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: Symbol("unserializable"),
        actor: USER_ACTOR
      });
      const event = await append(
        store,
        "a1",
        { x: 1 }
      );

      assert.strictEqual(rejected.ok, false);
      assert.strictEqual(event.eventId, 1);
      assert.strictEqual(event.eventVersion, 1);
      assert.strictEqual((await store.reader.listAll()).length, 1);
    });

    test("appends issued together are stored and notified in call order", async() => {
      await using store = await backend.create();
      const notified: number[] = [];
      store.subscribe((event) => notified.push(event.eventVersion));

      const appended = await Promise.all([
        append(store, "a1", { x: 1 }),
        append(store, "a1", { x: 2 }),
        append(store, "a1", { x: 3 })
      ]);

      assert.deepEqual(
        appended.map((event) => [event.eventId, event.eventVersion]),
        [[1, 1], [2, 2], [3, 3]]
      );
      assert.deepEqual(notified, [1, 2, 3]);
      assert.deepEqual(
        (await store.reader.list("a1")).map((event) => event.eventData),
        [{ x: 1 }, { x: 2 }, { x: 3 }]
      );
    });
  });

  describe(`${backend.name} — expectedVersion`, () => {
    test("appends when the asset is at the expected version", async() => {
      await using store = await backend.create();
      await append(store, "a1");

      const result = await store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: {},
        actor: USER_ACTOR,
        expectedVersion: 1
      });

      assert.strictEqual(result.unwrap().eventVersion, 2);
    });

    test("expects version 0 for an empty stream", async() => {
      await using store = await backend.create();

      const result = await store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: {},
        actor: USER_ACTOR,
        expectedVersion: 0
      });

      assert.strictEqual(result.unwrap().eventVersion, 1);
    });

    test("rejects a stale expected version without appending", async() => {
      await using store = await backend.create();
      await append(store, "a1");
      await append(store, "a1");

      const result = await store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: {},
        actor: USER_ACTOR,
        expectedVersion: 1
      });

      assert.strictEqual(result.ok, false);
      const error = result.val;
      assert.ok(error instanceof EventVersionConflictError);
      assert.strictEqual(error.assetId, "a1");
      assert.strictEqual(error.expectedVersion, 1);
      assert.strictEqual(error.actualVersion, 2);
      assert.strictEqual((await append(store, "a1")).eventVersion, 3);
    });
  });

  describe(`${backend.name} — actor`, () => {
    test("round-trips a user actor", async() => {
      await using store = await backend.create();
      await seed(store);

      assert.deepEqual(
        (await store.reader.list("a1"))[0].actor,
        USER_ACTOR
      );
    });

    test("round-trips a system actor", async() => {
      await using store = await backend.create();
      await seed(store);

      assert.deepEqual(
        (await store.reader.list("a2"))[0].actor,
        SYSTEM_ACTOR
      );
    });
  });
}
