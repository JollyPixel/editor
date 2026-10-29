// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  counterHandler,
  tileHandler,
  TILE_CHANGED,
  type TileCommand,
  type TileState
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

async function tilesAsset(
  harness: SyncHarness
): Promise<string> {
  const created = (await harness.writer.create({
    path: "w.tiles",
    actor: kActor
  })).unwrap();
  await harness.projector.flush();
  await harness.states.acquire(created.assetId, "tiles");

  return created.assetId;
}

async function change(
  harness: SyncHarness,
  assetId: string,
  command: TileCommand
): Promise<void> {
  (await harness.eventStore.writer.append({
    assetType: "tiles",
    assetId,
    eventType: TILE_CHANGED,
    eventData: command,
    actor: kActor
  })).unwrap();
}

async function replayed(
  harness: SyncHarness,
  assetId: string
): Promise<Record<string, string>> {
  harness.states.release(assetId);
  const entry = await harness.states.acquire(assetId, "tiles");

  return Object.fromEntries((entry.state as TileState).tiles);
}

async function lastParts(
  harness: SyncHarness,
  assetId: string
): Promise<Record<string, Record<string, unknown>>> {
  const event = (await harness.eventStore.reader.list(assetId)).at(-1);
  const data = event?.eventData as {
    parts: Record<string, Record<string, unknown>>;
  };

  return data.parts;
}

describe("SnapshotScheduler — parts", () => {
  test("a generation holds the touched parts and points at the others", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await change(harness, assetId, { action: "paint", tile: "b", value: "sand" });
    assert.strictEqual(await harness.scheduler.snapshot(assetId), true);

    const parts = await lastParts(harness, assetId);
    assert.deepEqual(Object.keys(parts).sort(), ["a", "b"]);
    assert.strictEqual(parts.a.at, 1);
    assert.strictEqual("content" in parts.a, false);
    assert.strictEqual("content" in parts.b, true);
  });

  test("replay restores parts held by older generations", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await change(harness, assetId, { action: "paint", tile: "a", value: "water" });
    await harness.scheduler.snapshot(assetId);
    await change(harness, assetId, { action: "paint", tile: "b", value: "sand" });
    await harness.scheduler.snapshot(assetId);
    await change(harness, assetId, { action: "paint", tile: "b", value: "dirt" });

    assert.deepEqual(await replayed(harness, assetId), {
      a: "water",
      b: "dirt"
    });
  });

  test("an erased part leaves the next generation", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await change(harness, assetId, { action: "paint", tile: "b", value: "sand" });
    await change(harness, assetId, { action: "erase", tile: "a" });
    await harness.scheduler.snapshot(assetId);

    assert.deepEqual(Object.keys(await lastParts(harness, assetId)), ["b"]);
    assert.deepEqual(await replayed(harness, assetId), { b: "sand" });
  });

  test("skips a generation when no part or manifest changed", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await change(harness, assetId, { action: "paint", tile: "a", value: "grass" });

    assert.strictEqual(await harness.scheduler.snapshot(assetId), false);
  });

  test("compaction keeps the events a generation reads parts from", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()],
      compact: true
    });
    const assetId = await tilesAsset(harness);

    await change(harness, assetId, { action: "paint", tile: "b", value: "sand" });
    await harness.scheduler.snapshot(assetId);
    await change(harness, assetId, { action: "paint", tile: "b", value: "dirt" });
    await harness.scheduler.snapshot(assetId);

    assert.deepEqual(await replayed(harness, assetId), {
      a: "grass",
      b: "dirt"
    });
  });
});

describe("AssetWriter — parts", () => {
  test("refuses parts for a kind that declares none", async() => {
    await using harness = await syncHarness({
      handlers: [counterHandler()]
    });

    const created = await harness.writer.create({
      path: "a.counter",
      data: bytes("0"),
      parts: new Map([["a", bytes("1")]]),
      actor: kActor
    });

    assert.strictEqual(created.ok, false);
    assert.strictEqual((await harness.eventStore.reader.listAll()).length, 0);
  });

  test("refuses a part id outside letters, digits, _ and -", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });

    const created = await harness.writer.create({
      path: "w.tiles",
      data: bytes("a"),
      parts: new Map([["../a", bytes("grass")]]),
      actor: kActor
    });

    assert.strictEqual(created.ok, false);
    assert.strictEqual((await harness.eventStore.reader.listAll()).length, 0);
  });
});
