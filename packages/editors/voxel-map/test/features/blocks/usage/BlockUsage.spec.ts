// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { BlockUsage } from "../../../../src/features/blocks/usage/BlockUsage.ts";

// CONSTANTS
const kUnused = new BlockUsage({ blockId: 1, voxels: 0, layers: [] });

describe("BlockUsage", () => {
  it("summarizes the usage of a block", () => {
    assert.equal(kUnused.summary, "Not placed in the map");
    assert.equal(
      new BlockUsage({
        blockId: 1,
        voxels: 1200,
        layers: [
          { layerName: "Ground", voxels: 1000 },
          { layerName: "Top", voxels: 200 }
        ]
      }).summary,
      "1,200 voxels in 2 layers"
    );
  });

  it("warns before removing a placed block", () => {
    assert.equal(kUnused.removalMessage, "No voxel uses this block.");
    assert.equal(
      new BlockUsage({
        blockId: 1,
        voxels: 1,
        layers: [{ layerName: "Ground", voxels: 1 }]
      }).removalMessage,
      "Used by 1 voxel in 1 layer. " +
      "Those voxels stay in the map but are no longer drawn."
    );
  });

  it("treats a removal that loses nothing as unused", () => {
    assert.equal(kUnused.unused, true);
    assert.equal(
      new BlockUsage({
        blockId: 1,
        voxels: 1,
        layers: [{ layerName: "Ground", voxels: 1 }]
      }).unused,
      false
    );
  });

  it("describes orphan voxels", () => {
    assert.equal(
      BlockUsage.orphanMessage(3, [7, 9]),
      "3 voxels of deleted blocks (#7, #9) cannot be drawn. " +
      "Remove them from every layer?"
    );
  });
});
