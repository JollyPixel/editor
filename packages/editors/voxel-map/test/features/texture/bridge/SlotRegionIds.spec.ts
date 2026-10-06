// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  composeBlockId,
  BlocksetSlot
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  SlotRegionIds
} from "../../../../src/features/texture/bridge/SlotRegionIds.ts";

describe("SlotRegionIds", () => {
  const regions = new SlotRegionIds(new BlocksetSlot({ id: "stone", slot: 2 }));

  it("reads a region id as a block of its slot", () => {
    assert.equal(regions.blockIdOf("block-4"), composeBlockId(2, 4));
    assert.equal(regions.blockIdOf("brick"), null);
  });

  it("names only the blocks its slot owns", () => {
    assert.equal(regions.regionIdOf(composeBlockId(2, 4)), "block-4");
    assert.equal(regions.regionIdOf(composeBlockId(3, 4)), null);
  });
});
