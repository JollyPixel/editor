// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodeVoxelDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createTilesetDocument,
  createVoxelMapDocument,
  tilesetAsset
} from "#src/index.ts";
import { opaquePng } from "../helpers/png.ts";

// CONSTANTS
const kTilesetDefinition = {
  id: "default",
  asset: tilesetAsset("tileset"),
  tileSize: 8
};

describe("createTilesetDocument", () => {
  test("resolves the tile grid from the image size", async() => {
    const tileset = await createTilesetDocument(
      opaquePng(32, 16),
      kTilesetDefinition
    );

    assert.deepEqual(tileset.size, { x: 32, y: 16 });
    assert.equal(tileset.definition.cols, 4);
    assert.equal(tileset.definition.rows, 2);
    assert.ok(tileset.content.byteLength > 0);
  });
});

describe("createVoxelMapDocument", () => {
  test("registers the tileset, its blocks and one layer", async() => {
    const { definition } = await createTilesetDocument(
      opaquePng(32, 16),
      kTilesetDefinition
    );
    const document = decodeVoxelDocument(
      createVoxelMapDocument({
        chunkSize: 16,
        tileset: definition
      })
    );

    assert.equal(document.chunkSize, 16);
    assert.deepEqual(document.tilesets?.map(({ id }) => id), ["default"]);
    assert.equal(document.blocks?.length, 8);
    assert.deepEqual(document.layers.map(({ name }) => name), ["Ground"]);
  });

  test("caps the blocks and names the layer", async() => {
    const { definition } = await createTilesetDocument(
      opaquePng(32, 16),
      kTilesetDefinition
    );
    const document = decodeVoxelDocument(
      createVoxelMapDocument({
        chunkSize: 16,
        tileset: definition,
        blockLimit: 3,
        layer: "Terrain"
      })
    );

    assert.equal(document.blocks?.length, 3);
    assert.deepEqual(document.layers.map(({ name }) => name), ["Terrain"]);
  });
});
