// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { BlocksetUsage } from "../../../src/features/blocksets/BlocksetUsage.ts";

describe("BlocksetUsage", () => {
  it("warns before removing a blockset", () => {
    assert.equal(
      new BlocksetUsage({ blocksetId: "a", blocks: [], voxels: 0 }).removalMessage,
      "No block uses this blockset."
    );
    assert.equal(
      new BlocksetUsage({ blocksetId: "a", blocks: [1], voxels: 0 }).removalMessage,
      "1 block (none placed in the map) comes from this blockset " +
      "and leaves the map with it."
    );
    assert.equal(
      new BlocksetUsage({ blocksetId: "a", blocks: [1, 2], voxels: 2048 }).removalMessage,
      "2 blocks (2,048 voxels in the map) come from this blockset " +
      "and leave the map with it."
    );
  });

  it("treats a blockset without blocks or voxels as unused", () => {
    assert.equal(
      new BlocksetUsage({ blocksetId: "a", blocks: [], voxels: 0 }).unused,
      true
    );
    assert.equal(
      new BlocksetUsage({ blocksetId: "a", blocks: [1], voxels: 0 }).unused,
      false
    );
  });

  it("summarizes the blocks and voxels drawn from a blockset", () => {
    assert.equal(
      new BlocksetUsage({ blocksetId: "a", blocks: [1], voxels: 1200 }).summary,
      "Used by 1 block, 1,200 voxels in the map."
    );
  });
});
