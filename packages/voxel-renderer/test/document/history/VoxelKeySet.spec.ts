// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelKeySet } from "../../../src/document/history/index.ts";

// CONSTANTS
const kCell = {
  layerId: "a",
  position: { x: -3, y: 40, z: -7 }
};

describe("VoxelKeySet", () => {
  it("holds each cell once, keyed by layer", () => {
    const keys = new VoxelKeySet([
      kCell,
      kCell,
      { layerId: "b", position: { x: 0, y: 0, z: 0 } }
    ]);

    assert.equal(keys.cellCount, 2);
    assert.deepEqual([...keys.cells()], [
      kCell,
      { layerId: "b", position: { x: 0, y: 0, z: 0 } }
    ]);
  });

  it("overlaps on a shared cell of the same layer only", () => {
    const keys = new VoxelKeySet([kCell]);
    const neighbour = {
      layerId: "a",
      position: { x: -3, y: 40, z: -6 }
    };

    assert.equal(keys.overlaps(new VoxelKeySet([kCell])), true);
    assert.equal(keys.overlaps(new VoxelKeySet([{ ...kCell, layerId: "b" }])), false);
    assert.equal(keys.overlaps(new VoxelKeySet([neighbour])), false);
  });

  it("a whole layer overlaps every cell of that layer, from either side", () => {
    const layer = new VoxelKeySet([], ["a"]);

    assert.equal(layer.overlaps(new VoxelKeySet([kCell])), true);
    assert.equal(new VoxelKeySet([kCell]).overlaps(layer), true);
    assert.equal(layer.overlaps(new VoxelKeySet([], ["a"])), true);
    assert.equal(layer.overlaps(new VoxelKeySet([{ ...kCell, layerId: "b" }], ["c"])), false);
  });
});
