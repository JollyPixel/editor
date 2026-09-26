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
  createVoxelMapDocument,
  tilesetAsset
} from "#src/index.ts";

describe("createVoxelMapDocument", () => {
  test("links the tilesets in slot order and opens one layer", () => {
    const document = decodeVoxelDocument(
      createVoxelMapDocument({
        chunkSize: 16,
        tilesets: [
          { id: "ground", asset: tilesetAsset("tileset-ground") },
          { id: "props", asset: tilesetAsset("tileset-props") }
        ]
      })
    );

    assert.equal(document.chunkSize, 16);
    assert.deepEqual(document.tilesets, [
      { id: "ground", slot: 0, asset: tilesetAsset("tileset-ground") },
      { id: "props", slot: 1, asset: tilesetAsset("tileset-props") }
    ]);
    assert.deepEqual(document.layers.map(({ name }) => name), ["Ground"]);
  });

  test("names the layer and links nothing by default", () => {
    const document = decodeVoxelDocument(
      createVoxelMapDocument({
        chunkSize: 8,
        layer: "Terrain"
      })
    );

    assert.deepEqual(document.tilesets, []);
    assert.deepEqual(document.layers.map(({ name }) => name), ["Terrain"]);
  });
});
