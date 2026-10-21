// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { liveTileHandler } from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";
import {
  roomHarness,
  type RoomHarness
} from "../helpers/live/roomHarness.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function tilesRoom(): Promise<RoomHarness> {
  return roomHarness({
    extraHandlers: [liveTileHandler()],
    asset: {
      kind: "tiles",
      path: "w.tiles"
    }
  });
}

async function joined(
  harness: RoomHarness,
  ...clientIds: string[]
): Promise<void> {
  for (const clientId of clientIds) {
    await harness.join(clientId);
  }
}

function payloads(
  harness: RoomHarness,
  clientId: string
): unknown[] {
  const received = harness.clients.get(clientId)?.received ?? [];

  return received
    .filter((envelope) => (envelope as { kind?: string; }).kind === "message")
    .map((envelope) => (envelope as { payload: unknown; }).payload);
}

function since(
  harness: RoomHarness,
  clientId: string,
  count: number
): unknown[] {
  return payloads(harness, clientId).slice(count);
}

function actions(
  received: unknown[]
): string[] {
  return received.map((payload) => (payload as { data: { action: string; }; }).data.action);
}

describe("AssetRoomExtension — parts", () => {
  test("a subscription answers with its parts at the room version", async() => {
    await using harness = await tilesRoom();
    await joined(harness, "A");

    await harness.send("A", { action: "subscribe-parts", parts: ["a", "z"] });

    assert.deepEqual(payloads(harness, "A").at(-1), {
      type: "parts",
      version: 1,
      parts: { a: "grass", z: null }
    });
  });

  test("a command reaches its author and its subscribers, others get its outside form", async() => {
    await using harness = await tilesRoom();
    await joined(harness, "A", "B", "C");
    await harness.send("B", { action: "subscribe-parts", parts: ["b"] });
    const seen = {
      A: payloads(harness, "A").length,
      B: payloads(harness, "B").length,
      C: payloads(harness, "C").length
    };

    await harness.send("A", { action: "paint", tile: "b", value: "sand" });
    await harness.send("A", { action: "erase", tile: "a" });

    assert.deepEqual(actions(since(harness, "A", seen.A)), ["paint", "erase"]);
    assert.deepEqual(actions(since(harness, "B", seen.B)), ["paint", "erase"]);
    assert.deepEqual(actions(since(harness, "C", seen.C)), ["erase"]);
  });

  test("an unsubscribed member no longer receives its parts' commands", async() => {
    await using harness = await tilesRoom();
    await joined(harness, "A", "B");
    await harness.send("B", { action: "subscribe-parts", parts: ["b"] });
    await harness.send("B", { action: "unsubscribe-parts", parts: ["b"] });
    const seen = payloads(harness, "B").length;

    await harness.send("A", { action: "paint", tile: "b", value: "sand" });

    assert.deepEqual(since(harness, "B", seen), []);
  });

  test("a reload sends each member its subscribed parts after the snapshot", async() => {
    await using harness = await tilesRoom();
    await joined(harness, "A");
    await harness.send("A", { action: "subscribe-parts", parts: ["a"] });
    const seen = payloads(harness, "A").length;

    (await harness.sync.writer.update({
      assetId: harness.assetId,
      data: bytes("a"),
      parts: new Map([["a", bytes("lava")]]),
      actor: kActor
    })).unwrap();

    assert.deepEqual(since(harness, "A", seen), [
      { type: "snapshot", data: ["a"], version: 2 },
      { type: "parts", version: 2, parts: { a: "lava" } }
    ]);
  });

  test("a tag room sends every tagged part after its snapshot", async() => {
    await using harness = await tilesRoom();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();

    await harness.join("A", new AssetRoom("tiles", harness.assetId, "v1").toString());

    assert.deepEqual(payloads(harness, "A"), [
      { type: "snapshot", data: ["a"], version: 1 },
      { type: "parts", version: 1, parts: { a: "grass" } }
    ]);
  });
});
