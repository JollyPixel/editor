// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import {
  tilesetIsUnused,
  tilesetRemovalMessage,
  tilesetUsageSummary
} from "../../../src/features/tilesets/tilesetUsage.ts";

describe("tilesetUsage", () => {
  it("warns before removing a tileset", () => {
    assert.equal(
      tilesetRemovalMessage({ tilesetId: "a", blocks: [], voxels: 0 }),
      "No block uses this tileset."
    );
    assert.equal(
      tilesetRemovalMessage({ tilesetId: "a", blocks: [1], voxels: 0 }),
      "1 block (none placed in the map) comes from this tileset " +
      "and leaves the map with it."
    );
    assert.equal(
      tilesetRemovalMessage({ tilesetId: "a", blocks: [1, 2], voxels: 2048 }),
      "2 blocks (2,048 voxels in the map) come from this tileset " +
      "and leave the map with it."
    );
  });

  it("treats a tileset without blocks or voxels as unused", () => {
    assert.equal(
      tilesetIsUnused({ tilesetId: "a", blocks: [], voxels: 0 }),
      true
    );
    assert.equal(
      tilesetIsUnused({ tilesetId: "a", blocks: [1], voxels: 0 }),
      false
    );
  });

  it("summarizes the blocks and voxels drawn from a tileset", () => {
    assert.equal(
      tilesetUsageSummary({ tilesetId: "a", blocks: [1], voxels: 1200 }),
      "Used by 1 block, 1,200 voxels in the map."
    );
  });
});
