// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";

function append(
  store: ReturnType<typeof EventStore.persistence.memory>,
  assetId: string,
  eventData: unknown = {}
): EventStore.Event {
  return store.writer.append({
    assetType: "texture",
    assetId,
    eventType: "pixel-set",
    eventData
  }).unwrap();
}

describe("MemoryEventStore — append", () => {
  test("assigns a monotonically increasing version per asset", () => {
    const store = EventStore.persistence.memory();

    const first = append(store, "a1", { x: 1 });
    const second = append(store, "a1", { x: 2 });

    assert.strictEqual(first.eventVersion, 1);
    assert.strictEqual(second.eventVersion, 2);
  });

  test("tracks versions independently per asset", () => {
    const store = EventStore.persistence.memory();

    append(store, "a1");
    const event = append(store, "a2");

    assert.strictEqual(event.eventVersion, 1);
  });

  test("round-trips event data through JSON, so mutating the input afterwards has no effect", () => {
    const store = EventStore.persistence.memory();
    const data = { nested: { value: 1 } };

    const event = append(store, "a1", data);
    data.nested.value = 999;

    assert.deepEqual(event.eventData, { nested: { value: 1 } });
  });
});

describe("MemoryEventStore — list", () => {
  test("returns events for the asset in version order", () => {
    const store = EventStore.persistence.memory();
    append(store, "a1", { x: 1 });
    append(store, "a1", { x: 2 });
    append(store, "a2", { x: 3 });

    const events = store.reader.list("a1");

    assert.deepEqual(events.map((event) => event.eventVersion), [1, 2]);
  });

  test("fromVersion excludes events at or before it", () => {
    const store = EventStore.persistence.memory();
    append(store, "a1", { x: 1 });
    append(store, "a1", { x: 2 });
    append(store, "a1", { x: 3 });

    const events = store.reader.list("a1", 1);

    assert.deepEqual(events.map((event) => event.eventVersion), [2, 3]);
  });

  test("returns an empty array for an unknown asset", () => {
    const store = EventStore.persistence.memory();

    assert.deepEqual(store.reader.list("missing"), []);
  });
});

describe("MemoryEventStore — dispose", () => {
  test("using calls close() on scope exit", () => {
    let closed = false;

    {
      using store = EventStore.persistence.memory();
      store.close = () => {
        closed = true;
      };
    }

    assert.strictEqual(closed, true);
  });

  test("close() clears stored events", () => {
    const store = EventStore.persistence.memory();
    append(store, "a1", { x: 1 });

    store[Symbol.dispose]();

    assert.deepEqual(store.reader.list("a1"), []);
  });
});

describe("MemoryEventStore — events", () => {
  test("emits 'append' with the stored event on success", () => {
    const store = EventStore.persistence.memory();
    const received: EventStore.Event[] = [];
    store.writer.on("append", (event) => received.push(event));

    const event = append(store, "a1", { x: 1 });

    assert.deepEqual(received, [event]);
  });

  test("emits 'error' with the failure and the input when append throws", () => {
    const store = EventStore.persistence.memory();
    const received: { error: Error; input: unknown; }[] = [];
    store.writer.on("error", (error, input) => received.push({ error, input }));

    const input = {
      assetType: "texture",
      assetId: "a1",
      eventType: "pixel-set",
      eventData: Symbol("unclonable")
    };
    const result = store.writer.append(input);

    assert.strictEqual(result.ok, false);
    assert.strictEqual(received.length, 1);
    assert.deepEqual(received[0].input, input);
  });
});
