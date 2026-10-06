// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodeVoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createVoxelMapDocument,
  blocksetAsset
} from "#src/index.ts";

describe("createVoxelMapDocument", () => {
  test("links the blocksets in slot order and opens one layer", () => {
    const document = decodeVoxelWorld(
      createVoxelMapDocument({
        chunkSize: 16,
        blocksets: [
          { id: "ground", asset: blocksetAsset("blockset-ground") },
          { id: "props", asset: blocksetAsset("blockset-props") }
        ]
      })
    );

    assert.equal(document.chunkSize, 16);
    assert.deepEqual(document.blocksets, [
      { id: "ground", slot: 0, asset: blocksetAsset("blockset-ground") },
      { id: "props", slot: 1, asset: blocksetAsset("blockset-props") }
    ]);
    assert.deepEqual(document.layers.map(({ name }) => name), ["Ground"]);
  });

  test("names the layer and links nothing by default", () => {
    const document = decodeVoxelWorld(
      createVoxelMapDocument({
        chunkSize: 8,
        layer: "Terrain"
      })
    );

    assert.deepEqual(document.blocksets, []);
    assert.deepEqual(document.layers.map(({ name }) => name), ["Terrain"]);
  });
});
