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
  describe(`${backend.name} — subscribe`, () => {
    test("calls the listener with every appended event", async() => {
      using store = await backend.create();
      const seen: string[] = [];
      store.subscribe((event) => seen.push(event.eventType));

      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "pixelart.command");

      assert.deepEqual(seen, ["asset.created", "pixelart.command"]);
    });

    test("filters on eventTypePrefix", async() => {
      using store = await backend.create();
      const seen: string[] = [];
      store.subscribe(
        (event) => seen.push(event.eventType),
        { eventTypePrefix: "asset." }
      );

      append(store, "a1", {}, "asset.created");
      append(store, "a1", {}, "pixelart.command");
      append(store, "a1", {}, "asset.updated");

      assert.deepEqual(seen, ["asset.created", "asset.updated"]);
    });

    test("stops calling the listener once unsubscribed", async() => {
      using store = await backend.create();
      const seen: string[] = [];
      const unsubscribe = store.subscribe(
        (event) => seen.push(event.eventType)
      );

      append(store, "a1", {}, "asset.created");
      unsubscribe();
      append(store, "a1", {}, "asset.updated");

      assert.deepEqual(seen, ["asset.created"]);
    });

    test("leaves other subscribers attached", async() => {
      using store = await backend.create();
      const seen: string[] = [];
      const unsubscribe = store.subscribe(() => void 0);
      store.subscribe((event) => seen.push(event.eventType));

      unsubscribe();
      append(store, "a1", {}, "asset.created");

      assert.deepEqual(seen, ["asset.created"]);
    });

    test("does not call the listener for a rejected append", async() => {
      using store = await backend.create();
      const seen: string[] = [];
      store.subscribe((event) => seen.push(event.eventType));

      const result = store.writer.append({
        assetType: "texture",
        assetId: "a1",
        eventType: "asset.created",
        eventData: undefined,
        actor: USER_ACTOR
      });

      assert.strictEqual(result.ok, false);
      assert.deepEqual(seen, []);
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
