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
  SYSTEM_ACTOR,
  USER_ACTOR,
  seed
} from "../helpers/backends.ts";

/**
 * Behaviour every backend owes the `EventStore` contract. Anything asserted
 * here is part of the contract, not of one implementation.
 */
for (const backend of backends) {
  describe(`${backend.name} — append`, () => {
    test("assigns a monotonically increasing version per asset", async() => {
      using store = await backend.create();

      const first = append(store, "a1", { x: 1 });
      const second = append(store, "a1", { x: 2 });

      assert.strictEqual(first.eventVersion, 1);
      assert.strictEqual(second.eventVersion, 2);
    });

    test("tracks versions independently per asset", async() => {
      using store = await backend.create();

      append(store, "a1");
      const event = append(store, "a2");

      assert.strictEqual(event.eventVersion, 1);
    });

    test("returns the event exactly as list serves it back", async() => {
      using store = await backend.create();

      const appended = append(store, "a1", { nested: { value: 1 } });
      const [read] = store.reader.list("a1");

      assert.deepEqual(appended, read);
    });

    test("does not alias the eventData it was given", async() => {
      using store = await backend.create();
      const eventData = { nested: { value: 1 } };

      const event = append(store, "a1", eventData);
      eventData.nested.value = 999;

      assert.deepEqual(event.eventData, { nested: { value: 1 } });
      assert.deepEqual(
        store.reader.list("a1")[0].eventData,
        { nested: { value: 1 } }
      );
    });

    test("round-trips eventData through JSON", async() => {
      using store = await backend.create();

      const event = append(store, "a1", {
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
      using store = await backend.create();

      const result = store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: 1n,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
    });

    test("a rejected append burns neither an eventId nor a version", async() => {
      using store = await backend.create();

      store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: Symbol("unserializable"),
        actor: USER_ACTOR
      });
      const event = append(store, "a1", { x: 1 });

      assert.strictEqual(event.eventId, 1);
      assert.strictEqual(event.eventVersion, 1);
      assert.strictEqual(store.reader.listAll().length, 1);
    });
  });

  describe(`${backend.name} — actor`, () => {
    test("round-trips a user actor", async() => {
      using store = await backend.create();
      seed(store);

      assert.deepEqual(store.reader.list("a1")[0].actor, USER_ACTOR);
    });

    test("round-trips a system actor", async() => {
      using store = await backend.create();
      seed(store);

      assert.deepEqual(store.reader.list("a2")[0].actor, SYSTEM_ACTOR);
    });
  });

  describe(`${backend.name} — list`, () => {
    test("returns events for the asset in version order", async() => {
      using store = await backend.create();
      append(store, "a1", { x: 1 });
      append(store, "a1", { x: 2 });
      append(store, "a2", { x: 3 });

      const events = store.reader.list("a1");

      assert.deepEqual(events.map((event) => event.eventVersion), [1, 2]);
    });

    test("fromVersion excludes events at or before it", async() => {
      using store = await backend.create();
      append(store, "a1", { x: 1 });
      append(store, "a1", { x: 2 });
      append(store, "a1", { x: 3 });

      const events = store.reader.list("a1", 1);

      assert.deepEqual(events.map((event) => event.eventVersion), [2, 3]);
    });

    test("returns an empty array for an unknown asset", async() => {
      using store = await backend.create();

      assert.deepEqual(store.reader.list("missing"), []);
    });

    test("hands back copies, so mutating a result cannot reach the log", async() => {
      using store = await backend.create();
      append(store, "a1", { value: 1 });

      const [event] = store.reader.list("a1");
      (event.eventData as { value: number; }).value = 999;

      assert.deepEqual(store.reader.list("a1")[0].eventData, { value: 1 });
    });
  });

  describe(`${backend.name} — listAll`, () => {
    test("returns append order across interleaved streams", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll();

      assert.deepEqual(events.map((event) => event.eventId), [1, 2, 3, 4]);
      assert.deepEqual(
        events.map((event) => event.assetId),
        ["a1", "a2", "a1", "a2"]
      );
    });

    test("fromEventId is an exclusive lower bound", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({ fromEventId: 2 });

      assert.deepEqual(events.map((event) => event.eventId), [3, 4]);
    });

    test("eventTypePrefix keeps only the matching prefix", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({ eventTypePrefix: "asset." });

      assert.deepEqual(
        events.map((event) => event.eventType),
        ["asset.created", "asset.created", "asset.updated"]
      );
    });

    test("eventTypePrefix matches wildcards literally", async() => {
      using store = await backend.create();
      append(store, "a1", {}, "asset.created");
      append(store, "a2", {}, "a*.created");

      const events = store.reader.listAll({ eventTypePrefix: "a*." });

      assert.deepEqual(events.map((event) => event.eventType), ["a*.created"]);
    });

    test("limit truncates from the start of the ordered result", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({ limit: 2 });

      assert.deepEqual(events.map((event) => event.eventId), [1, 2]);
    });

    test("combines every option", async() => {
      using store = await backend.create();
      seed(store);

      const events = store.reader.listAll({
        fromEventId: 1,
        eventTypePrefix: "asset.",
        limit: 1
      });

      assert.deepEqual(events.map((event) => event.eventId), [2]);
    });

    test("returns an empty array on an empty log", async() => {
      using store = await backend.create();

      assert.deepEqual(store.reader.listAll(), []);
    });
  });

  describe(`${backend.name} — close`, () => {
    test("a closed store rejects further operations", async() => {
      const store = await backend.create();
      store.close();

      assert.throws(() => append(store, "a1"));
      assert.throws(() => store.reader.list("a1"));
      assert.throws(() => store.reader.listAll());
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

  describe(`${backend.name} — events`, () => {
    test("emits an append event with the stored event on success", async() => {
      using store = await backend.create();
      const received: EventStore.Event[] = [];
      store.writer.on(
        "append",
        (event) => received.push(event)
      );

      const event = append(store, "a1", { x: 1 });

      assert.deepEqual(received, [event]);
    });

    test("emits an error event with the failure and the input", async() => {
      using store = await backend.create();
      const received: { error: Error; input: unknown; }[] = [];
      store.writer.on(
        "error",
        (error, input) => received.push({ error, input })
      );

      const input = {
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: 1n,
        actor: USER_ACTOR
      };
      const result = store.writer.append(input);

      assert.strictEqual(result.ok, false);
      assert.strictEqual(received.length, 1);
      assert.deepEqual(received[0].input, input);
    });
  });
}
