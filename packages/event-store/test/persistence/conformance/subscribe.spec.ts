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
    test("calls the listener with every stored event", async() => {
      await using store = await backend.create();
      const seen: EventStore.Event[] = [];
      store.subscribe((event) => seen.push(event));

      const appended = [
        await append(store, "a1", {}, "asset.created"),
        await append(store, "a1", {}, "pixelart.command")
      ];

      assert.deepEqual(seen, appended);
    });

    test("calls the listener before the append resolves", async() => {
      await using store = await backend.create();
      const order: string[] = [];
      store.subscribe(() => order.push("listener"));

      await append(store, "a1");
      order.push("resolved");

      assert.deepEqual(order, ["listener", "resolved"]);
    });

    test("filters on eventTypePrefix", async() => {
      await using store = await backend.create();
      const seen: string[] = [];
      store.subscribe(
        (event) => seen.push(event.eventType),
        { eventTypePrefix: "asset." }
      );

      await append(store, "a1", {}, "asset.created");
      await append(store, "a1", {}, "pixelart.command");
      await append(store, "a1", {}, "asset.updated");

      assert.deepEqual(seen, ["asset.created", "asset.updated"]);
    });

    test("stops calling the listener once unsubscribed", async() => {
      await using store = await backend.create();
      const seen: string[] = [];
      const unsubscribe = store.subscribe(
        (event) => seen.push(event.eventType)
      );

      await append(store, "a1", {}, "asset.created");
      unsubscribe();
      await append(store, "a1", {}, "asset.updated");

      assert.deepEqual(seen, ["asset.created"]);
    });

    test("leaves other subscribers attached", async() => {
      await using store = await backend.create();
      const seen: string[] = [];
      const unsubscribe = store.subscribe(() => void 0);
      store.subscribe((event) => seen.push(event.eventType));

      unsubscribe();
      await append(store, "a1", {}, "asset.created");

      assert.deepEqual(seen, ["asset.created"]);
    });

    test("does not call the listener for a rejected append", async() => {
      await using store = await backend.create();
      const seen: string[] = [];
      store.subscribe((event) => seen.push(event.eventType));

      const result = await store.writer.append({
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

  describe(`${backend.name} — subscribeRejections`, () => {
    test("calls the listener with the error and input until detached", async() => {
      await using store = await backend.create();
      const received: { error: Error; input: unknown; }[] = [];
      const unsubscribe = store.subscribeRejections(
        (error, input) => received.push({ error, input })
      );

      const input = {
        assetType: "texture",
        assetId: "a1",
        eventType: "pixel-set",
        eventData: 1n,
        actor: USER_ACTOR
      };
      const result = await store.writer.append(input);
      unsubscribe();
      await store.writer.append(input);

      assert.strictEqual(result.ok, false);
      assert.deepEqual(received, [{ error: result.val, input }]);
    });

    test("is not called for an accepted append", async() => {
      await using store = await backend.create();
      const received: Error[] = [];
      store.subscribeRejections((error) => received.push(error));

      await append(store, "a1", { x: 1 });

      assert.deepEqual(received, []);
    });
  });
}
