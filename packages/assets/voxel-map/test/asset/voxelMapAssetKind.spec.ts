// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  encodeContent,
  foldAssetEvent,
  type AssetEventData
} from "@jolly-pixel/asset-server";
import { encodeVoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_EXTENSION,
  VOXEL_MAP_KIND,
  blocksetAsset,
  voxelMapAssetKind,
  VoxelMapState
} from "../../src/index.ts";
import type { VoxelMapNetworkCommand } from "../../src/network/server.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";

function event(
  eventType: string,
  eventData: AssetEventData | VoxelMapNetworkCommand | unknown
): EventStore.Event {
  return {
    eventId: 1,
    assetType: VOXEL_MAP_KIND,
    assetId: "asset-1",
    eventType,
    eventData,
    eventVersion: 1,
    actor: {
      type: "user",
      id: "u1"
    },
    createdAt: new Date().toISOString()
  } as EventStore.Event;
}

function documentEvent(
  state: VoxelMapState
): EventStore.Event {
  const data = encodeVoxelWorld(state.toJSON());

  return event(ASSET_CREATED, {
    path: "world.voxelmap.json",
    kind: VOXEL_MAP_KIND,
    hash: "h1",
    size: data.byteLength,
    content: encodeContent(data)
  });
}

function positionDelta(
  layerId: string,
  delta: { x: number; y: number; z: number; }
): VoxelMapNetworkCommand {
  return {
    action: "position-updated",
    layerId,
    metadata: { delta },
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };
}

describe("voxelMapAssetKind", () => {
  test("rebinds copied blockset assets without changing blockset keys", () => {
    const handler = voxelMapAssetKind();
    const state = handler.create("map");
    state.blocksets.add({
      id: "default",
      asset: blocksetAsset("original"),
      tileSize: 16
    });

    handler.rebind?.(state, new Map([["original", "copied"]]));

    assert.strictEqual(state.blocksets.defaultBlocksetId, "default");
    assert.deepEqual(handler.dependencies?.(state), [
      blocksetAsset("copied")
    ]);
  });

  test("declares its kind and claims .voxelmap.json paths", () => {
    const handler = voxelMapAssetKind();

    assert.strictEqual(handler.kind, VOXEL_MAP_KIND);
    assert.deepEqual(Object.keys(handler.extensions), [VOXEL_MAP_EXTENSION]);
    assert.strictEqual(handler.match, undefined);
  });

  test("snapshots slower than the back-end default", () => {
    assert.deepEqual(
      voxelMapAssetKind().snapshot,
      {
        delay: 5_000,
        maxDelay: 60_000
      }
    );
  });

  test("creates an empty world at the configured chunk size", () => {
    const state = voxelMapAssetKind({ chunkSize: 8 }).create("asset-1");

    assert.strictEqual(state.world.chunkSize, 8);
    assert.deepEqual(state.world.getLayers(), []);
  });

  test("a lifecycle event loads the whole document", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const source = new VoxelMapState(16);
    source.world.restoreLayer({ id: "Ground", name: "Ground" });
    source.world.setVoxel("Ground", {
      position: { x: 1, y: 2, z: 3 },
      blockId: 7
    });
    source.blocksets.add({
      id: "default",
      src: "textures/blockset.png",
      tileSize: 32
    });

    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(source));

    assert.deepEqual(
      state.world.getLayers().map((layer) => layer.name),
      ["Ground"]
    );
    assert.strictEqual(
      state.world.getVoxelAt({ x: 1, y: 2, z: 3 })?.blockId,
      7
    );
  });

  test("keeps the blockset list a document arrived with", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const source = new VoxelMapState(16);
    source.blocksets.add({
      id: "default",
      src: "textures/blockset.png",
      tileSize: 32
    });

    const state = handler.create("asset-1");
    foldAssetEvent(handler, state, documentEvent(source));

    assert.deepEqual(state.toJSON().blocksets, source.blocksets.definitions());
  });

  test("a domain command mutates the folded world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.restoreLayer({ id: "Ground", name: "Ground" });

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, voxelSetCmd({
      x: 1,
      y: 0,
      z: 1,
      blockId: 3
    })));

    assert.strictEqual(
      state.world.getVoxelAt({ x: 1, y: 0, z: 1 })?.blockId,
      3
    );
  });

  test("a delta position applies exactly once per event", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    const layer = state.world.restoreLayer({ id: "Ground", name: "Ground" });

    foldAssetEvent(
      handler,
      state,
      event(VOXEL_MAP_COMMAND, positionDelta("Ground", {
        x: 2,
        y: 0,
        z: 0
      }))
    );

    assert.deepEqual(layer.position, {
      x: 2,
      y: 0,
      z: 0
    });
  });

  test("a world-replace command reloads the whole world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.restoreLayer({ id: "Stale", name: "Stale" });

    const replacement = new VoxelMapState(16);
    replacement.world.restoreLayer({ id: "Fresh", name: "Fresh" });

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
      action: "world-replace",
      data: replacement.toJSON(),
      clientId: "client-A",
      seq: 1,
      timestamp: 1000
    }));

    assert.deepEqual(
      state.world.getLayers().map((layer) => layer.name),
      ["Fresh"]
    );
  });

  test("a delete empties the world", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.restoreLayer({ id: "Ground", name: "Ground" });

    foldAssetEvent(handler, state, event(ASSET_DELETED, {
      path: "world.voxelmap.json",
      kind: VOXEL_MAP_KIND
    }));

    assert.deepEqual(state.world.getLayers(), []);
    assert.strictEqual(state.blocksets.size, 0);
  });
});
