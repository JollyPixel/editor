// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ASSET_UPDATED } from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import {
  ROOM_ACTOR,
  roomHarness
} from "../helpers/live/roomHarness.ts";

describe("registerAssetRooms — eviction", () => {
  test("expiry flushes the asset before releasing its state", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await using harness = await roomHarness({ graceMs: 100 });
    const room = new AssetRoom("counter", harness.assetId).toString();

    const connectionA = await harness.join("A");
    await harness.send("A", { action: "increment" });
    await connectionA.receive({ room, kind: "leave" });

    t.mock.timers.tick(100);
    await harness.server.settled(room);

    assert.strictEqual(
      new TextDecoder().decode(
        await harness.sync.source.read("a.counter")
      ),
      "1"
    );
    assert.strictEqual(harness.sync.states.has(harness.assetId), false);
  });
});

describe("registerAssetRooms — deletion", () => {
  test("deleting an asset notifies the members of its open room", async() => {
    await using harness = await roomHarness();
    const room = new AssetRoom("counter", harness.assetId).toString();
    await harness.join("A");

    (await harness.sync.writer.remove({
      assetId: harness.assetId,
      actor: ROOM_ACTOR
    })).unwrap();

    assert.deepEqual(harness.clients.get("A")!.received.at(-1), {
      room,
      kind: "message",
      payload: { type: "deleted" }
    });
  });
});

describe("registerAssetRooms — replaced content", () => {
  test("an update from outside the room sends every member the new snapshot", async() => {
    await using harness = await roomHarness();
    const room = new AssetRoom("counter", harness.assetId).toString();
    await harness.join("A");
    await harness.join("B");

    const updated = (await harness.sync.writer.update({
      assetId: harness.assetId,
      data: bytes("7"),
      actor: ROOM_ACTOR
    })).unwrap();

    for (const id of ["A", "B"]) {
      assert.deepEqual(harness.clients.get(id)!.received.at(-1), {
        room,
        kind: "message",
        payload: {
          type: "snapshot",
          data: { value: 7 },
          version: updated.eventVersion
        }
      });
    }
  });

  test("a scheduled snapshot of the room's own edits sends no snapshot", async() => {
    await using harness = await roomHarness();
    await harness.join("A");
    await harness.send("A", { action: "increment" });
    const received = harness.clients.get("A")!.received;
    const beforeSnapshot = received.length;

    await harness.sync.scheduler.flush();

    const last = (await harness.sync.eventStore.reader.list(harness.assetId)).at(-1);
    assert.strictEqual(last?.eventType, ASSET_UPDATED);
    assert.strictEqual(received.length, beforeSnapshot);
  });
});
