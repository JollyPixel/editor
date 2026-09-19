// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  encodeVoxelDocument,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  tilesetAsset,
  voxelMapAssetKind,
  VoxelMapState
} from "#src/index.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

function assetWorld(
  assetId: string
): VoxelWorldJSON {
  return {
    version: 1,
    chunkSize: 16,
    tilesets: [
      { id: "default", asset: tilesetAsset(assetId), tileSize: 32 }
    ],
    layers: []
  };
}

describe("tilesetAsset", () => {
  test("references a pixel-art asset", () => {
    assert.deepEqual(tilesetAsset("asset-1"), {
      id: "asset-1",
      kind: "pixelart"
    });
  });
});

describe("VoxelMapState tilesets", () => {
  test("load keeps the asset of every tileset", () => {
    const state = new VoxelMapState(16);
    state.load(assetWorld("tileset-default"));

    assert.deepEqual(state.toJSON().tilesets, [
      { id: "default", asset: tilesetAsset("tileset-default"), tileSize: 32 }
    ]);
    assert.deepEqual(state.dependencies(), [tilesetAsset("tileset-default")]);
  });

  test("an added tileset declares its asset", () => {
    const state = new VoxelMapState(16);
    state.applyCommand({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", asset: tilesetAsset("asset-stone"), tileSize: 32 }
    });

    assert.deepEqual(state.dependencies(), [tilesetAsset("asset-stone")]);
  });

  test("a url-backed tileset declares no dependency", () => {
    const state = new VoxelMapState(16);
    state.load(assetWorld("tileset-default"));
    state.applyCommand({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "textures/stone.png", tileSize: 32 }
    });

    assert.deepEqual(state.dependencies(), [tilesetAsset("tileset-default")]);
  });

  test("removing a tileset drops its dependency", () => {
    const state = new VoxelMapState(16);
    state.load(assetWorld("tileset-default"));
    state.applyCommand({
      ...kHeader,
      action: "tileset-removed",
      tilesetId: "default"
    });

    assert.deepEqual(state.dependencies(), []);
  });
});

describe("voxelMapAssetKind dependencies", () => {
  test("reads the tilesets of loaded content", () => {
    const handler = voxelMapAssetKind();
    const state = handler.create("map");
    handler.load(
      state,
      encodeVoxelDocument(assetWorld("tileset-default"))
    );

    assert.deepEqual(handler.dependencies?.(state), [
      tilesetAsset("tileset-default")
    ]);
  });
});
