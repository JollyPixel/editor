// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  encodeVoxelWorld,
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  BLOCKSET_FILE,
  BLOCKSET_KIND,
  blocksetAsset,
  createBlocksetFile,
  voxelMapAssetKind,
  VoxelMapState
} from "#src/index.ts";
import { createBlocksetAsset } from "#src/asset/blocksetAssets.ts";

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
    version: VOXEL_WORLD_VERSION,
    chunkSize: 16,
    blocksets: [
      { id: "default", slot: 0, asset: blocksetAsset(assetId) }
    ],
    layers: []
  };
}

describe("blocksetAsset", () => {
  test("references a blockset asset", () => {
    assert.deepEqual(blocksetAsset("asset-1"), {
      id: "asset-1",
      kind: BLOCKSET_KIND
    });
  });
});

describe("VoxelMapState blocksets", () => {
  test("load keeps the link of every blockset", () => {
    const state = new VoxelMapState(16);
    state.load(assetWorld("blockset-default"));

    assert.deepEqual(state.toJSON().blocksets, [
      { id: "default", slot: 0, asset: blocksetAsset("blockset-default") }
    ]);
    assert.deepEqual(state.dependencies(), [blocksetAsset("blockset-default")]);
  });

  test("an added blockset declares its asset", () => {
    const state = new VoxelMapState(16);
    state.applyCommand({
      ...kHeader,
      action: "blockset-added",
      blockset: { id: "stone", asset: blocksetAsset("asset-stone") }
    });

    assert.deepEqual(state.dependencies(), [blocksetAsset("asset-stone")]);
  });

  test("a url-backed blockset declares no dependency", () => {
    const state = new VoxelMapState(16);
    state.load(assetWorld("blockset-default"));
    state.applyCommand({
      ...kHeader,
      action: "blockset-added",
      blockset: { id: "stone", src: "textures/stone.png", tileSize: 32 }
    });

    assert.deepEqual(state.dependencies(), [blocksetAsset("blockset-default")]);
  });

  test("removing a blockset drops its dependency", () => {
    const state = new VoxelMapState(16);
    state.load(assetWorld("blockset-default"));
    state.applyCommand({
      ...kHeader,
      action: "blockset-removed",
      blocksetId: "default"
    });

    assert.deepEqual(state.dependencies(), []);
  });
});

describe("voxelMapAssetKind dependencies", () => {
  test("reads the blocksets of loaded content", () => {
    const handler = voxelMapAssetKind();
    const state = handler.create("map");
    handler.load(
      state,
      encodeVoxelWorld(assetWorld("blockset-default"))
    );

    assert.deepEqual(handler.dependencies?.(state), [
      blocksetAsset("blockset-default")
    ]);
  });
});

describe("createBlocksetAsset", () => {
  test("creates an encoded blockset with a suffixed path on conflict", async() => {
    const calls: [string, Uint8Array, CatalogCreateOptions | undefined][] = [];
    const catalog = {
      async create(
        path: string,
        content: Uint8Array,
        options?: CatalogCreateOptions
      ) {
        calls.push([path, content, options]);

        return "asset-2";
      }
    };
    const file = createBlocksetFile({
      tileSize: 8,
      size: { x: 16, y: 8 }
    });

    const assetId = await createBlocksetAsset(
      catalog,
      "textures/stone.blockset.json",
      file
    );

    assert.equal(assetId, "asset-2");
    assert.equal(calls.length, 1);
    const [path, content, options] = calls[0];
    assert.equal(path, "textures/stone.blockset.json");
    assert.deepEqual(BLOCKSET_FILE.decode(content), file);
    assert.deepEqual(options, {
      kind: BLOCKSET_KIND,
      onConflict: "suffix"
    });
  });
});
