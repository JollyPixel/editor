// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
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
  it("round-trips the region id of a block", () => {
    assert.equal(BlockUv.regionIdOf(4), "block-4");
    assert.equal(BlockUv.blockIdOf("block-4"), 4);
    assert.equal(BlockUv.blockIdOf("block-x"), null);
    assert.equal(BlockUv.blockIdOf("other-4"), null);
  });

  it("knows the tilesets its shape samples", () => {
    const uv = uvOf({
      defaultTexture: { tilesetId: "stone", col: 0, row: 0 }
    });

    assert.equal(uv.textured, true);
    assert.equal(uv.usesTileset("stone"), true);
    assert.equal(uv.usesTileset("wood"), false);
    assert.equal(uvOf({}).textured, false);
  });

  it("stacks a box block and moves it back through its region", () => {
    const uv = uvOf({
      defaultTexture: { tilesetId: "stone", col: 1, row: 0 }
    });
    const region = uv.region();

    assert.equal(region.state, "stacked");
    assert.equal(region.id, "block-4");
    assert.deepEqual(uv.apply(region).defaultTexture, {
      tilesetId: "stone",
      col: 1,
      row: 0
    });
    assert.equal(BlockUv.sameRegion(region, uv.region()), true);
    assert.equal(BlockUv.sameRegion(region, uv.freeRegion()), false);
  });
});
