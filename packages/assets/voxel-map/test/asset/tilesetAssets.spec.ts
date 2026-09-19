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
  migrateTilesetDefinition,
  migrateTilesetSources,
  tilesetAsset,
  tilesetDependencies,
  voxelMapAssetHandler,
  VoxelMapState
} from "#src/index.ts";

// CONSTANTS
const kHeader = {
  clientId: "client-A",
  seq: 1,
  timestamp: 1000
};

function legacyWorld(
  src: string
): VoxelWorldJSON {
  return {
    version: 1,
    chunkSize: 16,
    tilesets: [
      { id: "default", src, tileSize: 32 }
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

describe("migrateTilesetDefinition", () => {
  test("moves an asset id stored in src to asset", () => {
    assert.deepEqual(
      migrateTilesetDefinition({ id: "a", src: "tileset-default", tileSize: 32 }),
      { id: "a", asset: tilesetAsset("tileset-default"), tileSize: 32 }
    );
    assert.deepEqual(
      migrateTilesetDefinition({
        id: "a",
        src: "0f8fad5b-d9cb-469f-a165-70867728950e",
        tileSize: 16,
        cols: 4
      }),
      {
        id: "a",
        asset: tilesetAsset("0f8fad5b-d9cb-469f-a165-70867728950e"),
        tileSize: 16,
        cols: 4
      }
    );
  });

  test("keeps URLs and asset-backed definitions", () => {
    for (const definition of [
      { id: "a", src: "textures/tileset.png", tileSize: 32 },
      { id: "a", src: "tileset.png", tileSize: 32 },
      { id: "a", src: "https://cdn/tileset", tileSize: 32 },
      { id: "a", asset: tilesetAsset("x"), tileSize: 32 }
    ]) {
      assert.strictEqual(migrateTilesetDefinition(definition), definition);
    }
  });
});

describe("migrateTilesetSources", () => {
  test("migrates every tileset of a document without mutating it", () => {
    const document = legacyWorld("tileset-default");
    const migrated = migrateTilesetSources(document);

    assert.deepEqual(migrated.tilesets, [
      { id: "default", asset: tilesetAsset("tileset-default"), tileSize: 32 }
    ]);
    assert.strictEqual(document.tilesets[0].src, "tileset-default");
  });
});

describe("tilesetDependencies", () => {
  test("lists asset-backed tilesets only", () => {
    assert.deepEqual(tilesetDependencies([
      { id: "a", asset: tilesetAsset("one"), tileSize: 32 },
      { id: "b", src: "textures/b.png", tileSize: 32 },
      { id: "c", asset: tilesetAsset("two"), tileSize: 16 }
    ]), [
      tilesetAsset("one"),
      tilesetAsset("two")
    ]);
  });
});

describe("VoxelMapState tilesets", () => {
  test("load migrates a legacy document", () => {
    const state = new VoxelMapState(16);
    state.load(legacyWorld("tileset-default"));

    assert.deepEqual(state.toJSON().tilesets, [
      { id: "default", asset: tilesetAsset("tileset-default"), tileSize: 32 }
    ]);
    assert.deepEqual(state.dependencies(), [tilesetAsset("tileset-default")]);
  });

  test("a legacy tileset-added command is migrated", () => {
    const state = new VoxelMapState(16);
    state.applyCommand({
      ...kHeader,
      action: "tileset-added",
      tileset: { id: "stone", src: "asset-stone", tileSize: 32 }
    });

    assert.deepEqual(state.dependencies(), [tilesetAsset("asset-stone")]);
  });

  test("removing a tileset drops its dependency", () => {
    const state = new VoxelMapState(16);
    state.load(legacyWorld("tileset-default"));
    state.applyCommand({
      ...kHeader,
      action: "tileset-removed",
      tilesetId: "default"
    });

    assert.deepEqual(state.dependencies(), []);
  });
});

describe("voxelMapAssetHandler dependencies", () => {
  test("reads the tilesets of loaded content", () => {
    const handler = voxelMapAssetHandler();
    const state = handler.create("map");
    handler.load(
      state,
      encodeVoxelDocument(legacyWorld("tileset-default"))
    );

    assert.deepEqual(handler.dependencies?.(state), [
      tilesetAsset("tileset-default")
    ]);
  });
});
