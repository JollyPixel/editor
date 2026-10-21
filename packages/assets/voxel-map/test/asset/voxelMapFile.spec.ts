// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createVoxelMapFile,
  blocksetAsset
} from "#src/index.ts";

describe("createVoxelMapFile", () => {
  test("links the blocksets in slot order and opens one layer", () => {
    const file = createVoxelMapFile({
      chunkSize: 16,
      blocksets: [
        { id: "ground", asset: blocksetAsset("blockset-ground") },
        { id: "props", asset: blocksetAsset("blockset-props") }
      ]
    });

    assert.equal(file.chunkSize, 16);
    assert.deepEqual(file.blocksets, [
      { id: "ground", slot: 0, asset: blocksetAsset("blockset-ground") },
      { id: "props", slot: 1, asset: blocksetAsset("blockset-props") }
    ]);
    assert.deepEqual(file.layers.map(({ name }) => name), ["Ground"]);
  });

  test("names the layer and links nothing by default", () => {
    const file = createVoxelMapFile({
      chunkSize: 8,
      layer: "Terrain"
    });

    assert.deepEqual(file.blocksets, []);
    assert.deepEqual(file.layers.map(({ name }) => name), ["Terrain"]);
  });
});
