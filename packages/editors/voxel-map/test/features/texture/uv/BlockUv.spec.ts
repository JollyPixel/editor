// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  composeBlockId,
  resolveBlockDefinition,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockUv } from "../../../../src/features/texture/uv/BlockUv.ts";

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();

function uvOf(
  patch: Partial<BlockDefinition>
): BlockUv {
  const block = resolveBlockDefinition({
    id: 4,
    name: "Block",
    shapeId: "cube",
    ...patch
  });

  return new BlockUv(block, kShapes.get(block.shapeId), 16);
}

describe("BlockUv", () => {
  it("names the region after the block's id inside its blockset", () => {
    const block = resolveBlockDefinition({
      id: composeBlockId(3, 4),
      name: "Block",
      shapeId: "cube",
      defaultTexture: { blocksetId: "stone", col: 0, row: 0 }
    });
    const uv = new BlockUv(block, kShapes.get("cube"), 16);

    assert.equal(uv.regionId, "block-4");
    assert.equal(uv.region().id, "block-4");
  });

  it("knows the blocksets its shape samples", () => {
    const uv = uvOf({
      defaultTexture: { blocksetId: "stone", col: 0, row: 0 }
    });

    assert.equal(uv.textured, true);
    assert.equal(uv.layout.usesBlockset("stone"), true);
    assert.equal(uv.layout.usesBlockset("wood"), false);
    assert.equal(uvOf({}).textured, false);
  });

  it("stacks a box block and moves it back through its region", () => {
    const uv = uvOf({
      defaultTexture: { blocksetId: "stone", col: 1, row: 0 }
    });
    const region = uv.region();

    assert.equal(region.state, "stacked");
    assert.equal(region.id, "block-4");
    assert.deepEqual(uv.apply(region).defaultTexture, {
      blocksetId: "stone",
      col: 1,
      row: 0
    });
    assert.equal(BlockUv.sameRegion(region, uv.region()), true);
    assert.equal(BlockUv.sameRegion(region, uv.freeRegion()), false);
  });
});
