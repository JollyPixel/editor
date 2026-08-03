// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as EventStore from "#src/index.ts";

type SqliteEventStore = Awaited<
  ReturnType<typeof EventStore.persistence.sqlite>
>;

function append(
  store: SqliteEventStore,
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

describe("SqliteEventStore — append", () => {
  test("assigns a monotonically increasing version per asset", async() => {
    const store = await EventStore.persistence.sqlite();

    const first = append(store, "a1", { x: 1 });
    const second = append(store, "a1", { x: 2 });

    assert.strictEqual(first.eventVersion, 1);
    assert.strictEqual(second.eventVersion, 2);
    store.close();
  });

  test("tracks versions independently per asset", async() => {
    const store = await EventStore.persistence.sqlite();

    append(store, "a1");
    const event = append(store, "a2");

    assert.strictEqual(event.eventVersion, 1);
    store.close();
  });

  test("round-trips event data through JSON", async() => {
    const store = await EventStore.persistence.sqlite();

    const event = append(store, "a1", { nested: { value: 1 } });

    assert.deepEqual(event.eventData, { nested: { value: 1 } });
    store.close();
  });
});

describe("SqliteEventStore — list", () => {
  test("returns events for the asset in version order", async() => {
    const store = await EventStore.persistence.sqlite();
    append(store, "a1", { x: 1 });
    append(store, "a1", { x: 2 });
    append(store, "a2", { x: 3 });

    const events = store.reader.list("a1");

    assert.deepEqual(events.map((event) => event.eventVersion), [1, 2]);
    store.close();
  });

  test("fromVersion excludes events at or before it", async() => {
    const store = await EventStore.persistence.sqlite();
    append(store, "a1", { x: 1 });
    append(store, "a1", { x: 2 });
    append(store, "a1", { x: 3 });

    const events = store.reader.list("a1", 1);

    assert.deepEqual(events.map((event) => event.eventVersion), [2, 3]);
    store.close();
  });

  test("returns an empty array for an unknown asset", async() => {
    const store = await EventStore.persistence.sqlite();

    assert.deepEqual(store.reader.list("missing"), []);
    store.close();
  });
});

describe("SqliteEventStore — durability", () => {
  test("data survives across instances backed by the same file", async(t) => {
    const path = await import("node:path");
    const os = await import("node:os");
    const fs = await import("node:fs");
    const file = path.join(os.tmpdir(), `network-event-store-${process.pid}-${Date.now()}.sqlite`);
    t.after(() => fs.rmSync(file, { force: true }));

    const first = await EventStore.persistence.sqlite(file);
    append(first, "a1", { x: 1 });
    first.close();

    const second = await EventStore.persistence.sqlite(file);
    const events = second.reader.list("a1");
    second.close();

    assert.deepEqual(events.map((event) => event.eventData), [{ x: 1 }]);
  });
});

describe("SqliteEventStore — dispose", () => {
  test("using calls close() on scope exit", async() => {
    let closed = false;

    {
      using store = await EventStore.persistence.sqlite();
      store.close = () => {
        closed = true;
      };
    }

    assert.strictEqual(closed, true);
  });

  test("closed instance rejects further operations", async() => {
    const store = await EventStore.persistence.sqlite();
    store[Symbol.dispose]();

    assert.throws(() => append(store, "a1"));
  });
});

describe("SqliteEventStore — events", () => {
  test("emits 'append' with the stored event on success", async() => {
    const store = await EventStore.persistence.sqlite();
    const received: EventStore.Event[] = [];
    store.writer.on("append", (event) => received.push(event));

    const event = append(store, "a1", { x: 1 });
    store.close();

    assert.deepEqual(received, [event]);
  });

  test("emits 'error' with the failure and the input when append throws", async() => {
    const store = await EventStore.persistence.sqlite();
    const received: { error: Error; input: unknown; }[] = [];
    store.writer.on("error", (error, input) => received.push({ error, input }));

    const input = { assetType: "texture", assetId: "a1", eventType: "pixel-set", eventData: 1n };
    const result = store.writer.append(input);
    store.close();

    assert.strictEqual(result.ok, false);
    assert.strictEqual(received.length, 1);
    assert.deepEqual(received[0].input, input);
  });
});

describe("SqliteEventStore — subpath entrypoint", () => {
  test("exposes the same factory as persistence.sqlite", async() => {
    const { createSqliteEventStore } = await import("#src/persistence/sqlite/index.ts");

    using store = await createSqliteEventStore();
    const event = append(store, "a1", { x: 1 });

    assert.strictEqual(event.eventVersion, 1);
  });
});
