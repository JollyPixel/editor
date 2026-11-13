// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { foldAssetEvent, type AssetEventData } from "@jolly-pixel/asset-server";
import { SchemaParser } from "@jolly-pixel/network";
import { decodeVoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  ASSET_KINDS,
  BLOCKSET_KIND,
  BlocksetState,
  VOXEL_MAP_COMMAND,
  VOXEL_MAP_KIND,
  VoxelMapState,
  blocksetAsset,
  voxelMapAssetKind
} from "../../src/index.ts";
import type { VoxelMapNetworkCommand } from "../../src/network/server.ts";
import { voxelSetCmd } from "../helpers/networkCommands.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

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

describe("voxelMapAssetKind — blocksets", () => {
  const kHeader = {
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };

  test("a linked blockset receives a slot and survives serialization", async() => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
      ...kHeader,
      action: "blockset-added",
      blockset: {
        id: "stone",
        asset: blocksetAsset("asset-stone")
      }
    }));

    const document = decodeVoxelWorld(await handler.serialize(state));

    assert.deepEqual(document.blocksets, [
      { id: "stone", slot: 0, asset: blocksetAsset("asset-stone") }
    ]);
    assert.deepEqual(handler.dependencies?.(state), [
      blocksetAsset("asset-stone")
    ]);
  });

  test("a block command is not part of the map stream", () => {
    const handler = voxelMapAssetKind({ chunkSize: 16 });
    const state = handler.create("asset-1");
    state.world.restoreLayer({ id: "Ground", name: "Ground" });

    foldAssetEvent(handler, state, event(VOXEL_MAP_COMMAND, {
      ...kHeader,
      action: "block-defined",
      block: makeBlockDef(3, "cube")
    }));
    foldAssetEvent(
      handler,
      state,
      event(VOXEL_MAP_COMMAND, voxelSetCmd({ blockId: 3, seq: 2 }))
    );

    assert.strictEqual(state.world.voxelAt({ x: 0, y: 0, z: 0 })?.blockId, 3);
    assert.strictEqual("blocks" in state, false);
  });
});

describe("ASSET_KINDS", () => {
  test("describes every kind it handles", () => {
    const handlers = ASSET_KINDS.handlers();

    assert.deepEqual(
      handlers.map((handler) => handler.kind),
      [BLOCKSET_KIND, VOXEL_MAP_KIND]
    );
    assert.deepEqual(
      ASSET_KINDS.descriptors.map((descriptor) => descriptor.kind),
      [BLOCKSET_KIND, VOXEL_MAP_KIND]
    );
  });

  test("passes the options of each kind to its handler", () => {
    const [blocksetHandler, voxelMapHandler] = ASSET_KINDS.handlers({
      blockset: {
        tileSize: 16
      },
      voxelmap: {
        chunkSize: 8
      }
    });
    const blockset = blocksetHandler.create("blockset-1");
    const voxelMap = voxelMapHandler.create("map-1");

    assert.ok(blockset instanceof BlocksetState);
    assert.ok(voxelMap instanceof VoxelMapState);
    assert.strictEqual(blockset.document.tileSize, 16);
    assert.strictEqual(voxelMap.world.chunkSize, 8);
  });

  test("accepts only the JSON options of each handler", () => {
    const parser = new SchemaParser(ASSET_KINDS.optionsSchema);

    assert.ok(parser.parse({
      blockset: {
        tileSize: 16,
        defaultSize: {
          x: 128,
          y: 128
        }
      },
      voxelmap: {
        chunkSize: 8
      }
    }).ok);
    for (const options of [
      { blockset: { tileSize: 0 } },
      { blockset: { defaultSize: { x: 128 } } },
      { voxelmap: { chunkSize: 1.5 } },
      { voxelmap: { layer: "Ground" } },
      { chunkSize: 8 }
    ]) {
      assert.ok(parser.parse(options).err, JSON.stringify(options));
    }
  });
});
