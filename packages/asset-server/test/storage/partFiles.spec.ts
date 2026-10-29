// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  CatalogFolders,
  CatalogProjection
} from "#src/index.ts";
import {
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  tileHandler,
  TILE_CHANGED,
  type TileCommand,
  type TileState
} from "../helpers/kinds.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

async function tilesAsset(
  harness: SyncHarness,
  path = "w.tiles"
): Promise<string> {
  const created = (await harness.writer.create({
    path,
    actor: kActor
  })).unwrap();
  await harness.flush();

  return created.assetId;
}

async function change(
  harness: SyncHarness,
  assetId: string,
  command: TileCommand
): Promise<void> {
  await harness.states.acquire(assetId, "tiles");
  (await harness.eventStore.writer.append({
    assetType: "tiles",
    assetId,
    eventType: TILE_CHANGED,
    eventData: command,
    actor: kActor
  })).unwrap();
  await harness.scheduler.snapshot(assetId);
  await harness.flush();
}

async function files(
  harness: SyncHarness
): Promise<Record<string, string>> {
  const listed: Record<string, string> = {};
  for (const path of await harness.source.list()) {
    listed[path] = text(await harness.source.read(path));
  }

  return listed;
}

async function replayed(
  harness: SyncHarness,
  assetId: string
): Promise<Record<string, string>> {
  harness.states.release(assetId);
  const entry = await harness.states.acquire(assetId, "tiles");

  return Object.fromEntries((entry.state as TileState).tiles);
}

describe("AssetProjector — part files", () => {
  test("writes each part beside the manifest and deletes erased ones", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await change(harness, assetId, { action: "paint", tile: "b", value: "sand" });
    await change(harness, assetId, { action: "erase", tile: "a" });

    assert.deepEqual(await files(harness), {
      "w.tiles": "b",
      "w.tiles.parts/b.tile": "sand"
    });
  });

  test("a rename moves the parts folder and a delete removes it", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await harness.writer.rename({ assetId, to: "maps/w.tiles", actor: kActor });
    await harness.flush();
    assert.deepEqual(await files(harness), {
      "maps/w.tiles": "a",
      "maps/w.tiles.parts/a.tile": "grass"
    });
    assert.deepEqual(await harness.source.folders(), [
      "maps",
      "maps/w.tiles.parts"
    ]);

    await harness.writer.remove({ assetId, actor: kActor });
    await harness.flush();
    assert.deepEqual(await files(harness), {});
    assert.deepEqual(await harness.source.folders(), ["maps"]);
  });
});

describe("Reconciler — part files", () => {
  test("an edited part file updates its asset, in a scoped pass too", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await harness.source.write("w.tiles.parts/a.tile", bytes("lava"));
    const scoped = (
      await harness.reconciler.reconcile(["w.tiles.parts/a.tile"])
    ).unwrap();
    await harness.source.write("w.tiles.parts/a.tile", bytes("snow"));
    const full = (await harness.reconciler.reconcile()).unwrap();

    assert.deepEqual([scoped.updated, full.updated], [1, 1]);
    assert.deepEqual([scoped.created, full.created], [0, 0]);
    assert.deepEqual(await replayed(harness, assetId), { a: "snow" });
  });

  test("a missing part file leaves its part in the asset", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const assetId = await tilesAsset(harness);

    await harness.source.delete("w.tiles.parts/a.tile");
    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.updated, 0);
    assert.deepEqual(await replayed(harness, assetId), { a: "grass" });
  });

  test("a fresh source creates the asset with its parts", async() => {
    const source = new MemoryAssetSource();
    await source.write("w.tiles", bytes("a,b"));
    await source.write("w.tiles.parts/a.tile", bytes("grass"));
    await source.write("w.tiles.parts/b.tile", bytes("sand"));
    await using harness = await syncHarness({
      handlers: [tileHandler()],
      source
    });

    const report = (await harness.reconciler.reconcile()).unwrap();
    const [{ assetId }] = await harness.eventStore.reader.listAll();

    assert.strictEqual(report.created, 1);
    assert.deepEqual(await replayed(harness, assetId), {
      a: "grass",
      b: "sand"
    });
  });

  test("a .parts folder of a kind without parts holds assets", async() => {
    const source = new MemoryAssetSource();
    await source.write("x.png.parts/a.tile", bytes("grass"));
    await using harness = await syncHarness({
      handlers: [tileHandler()],
      source
    });

    const report = (await harness.reconciler.reconcile()).unwrap();

    assert.strictEqual(report.created, 1);
  });
});

describe("CatalogFolders — part files", () => {
  test("lists no parts folder", async() => {
    await using harness = await syncHarness({
      handlers: [tileHandler()]
    });
    const catalog = new CatalogProjection({ projector: harness.projector });
    const folders = new CatalogFolders({
      source: harness.source,
      catalog,
      flush: () => harness.flush(),
      kinds: harness.kinds
    });
    await tilesAsset(harness, "maps/w.tiles");

    await folders.refresh();

    assert.deepEqual(folders.toJSON(), ["maps"]);
    folders.close();
  });
});
