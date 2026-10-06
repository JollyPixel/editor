// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { findBlocksReferencingBlockset } from "../../../src/features/blocksets/blockTextureTiles.ts";

const kShapes = BlockShapeRegistry.createDefault();
function shapeOf(shapeId: string) {
  return kShapes.get(shapeId);
}

function makeBlock(
  id: number,
  options: {
    defaultTexture?: ResolvedBlockDefinition["defaultTexture"];
    faceTextures?: ResolvedBlockDefinition["faceTextures"];
  }
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    properties: {},
    faceTextures: options.faceTextures ?? {},
    defaultTexture: options.defaultTexture
  };
}

describe("findBlocksReferencingBlockset", () => {
  it("matches a block via defaultTexture", () => {
    const block = makeBlock(1, { defaultTexture: { blocksetId: "atlas", col: 0, row: 0 } });

    const result = findBlocksReferencingBlockset([block], shapeOf, "atlas", 16);

    assert.equal(result.length, 1);
    assert.equal(result[0].block, block);
    assert.deepEqual(result[0].rects, [{ x: 0, y: 0, width: 16, height: 16 }]);
  });

  it("matches a block via a faceTextures entry, independently of defaultTexture", () => {
    const block = makeBlock(1, {
      defaultTexture: { blocksetId: "other", col: 0, row: 0 },
      faceTextures: { top: { blocksetId: "atlas", col: 2, row: 1 } }
    });

    const result = findBlocksReferencingBlockset([block], shapeOf, "atlas", 16);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].rects, [{ x: 32, y: 16, width: 16, height: 16 }]);
  });

  it("collects rects from every matching reference (default + multiple faces)", () => {
    const block = makeBlock(1, {
      defaultTexture: { blocksetId: "atlas", col: 0, row: 0 },
      faceTextures: {
        top: { blocksetId: "atlas", col: 1, row: 0 },
        bottom: { blocksetId: "other", col: 5, row: 5 }
      }
    });

    const result = findBlocksReferencingBlockset([block], shapeOf, "atlas", 16);

    assert.equal(result.length, 1);
    assert.deepEqual(result[0].rects, [
      { x: 0, y: 0, width: 16, height: 16 },
      { x: 16, y: 0, width: 16, height: 16 }
    ]);
  });

  it("excludes blocks that reference a different blockset entirely", () => {
    const block = makeBlock(1, { defaultTexture: { blocksetId: "other", col: 0, row: 0 } });

    const result = findBlocksReferencingBlockset([block], shapeOf, "atlas", 16);

    assert.equal(result.length, 0);
  });

  it("excludes a block with no defaultTexture and no matching face", () => {
    const block = makeBlock(1, {});

    const result = findBlocksReferencingBlockset([block], shapeOf, "atlas", 16);

    assert.equal(result.length, 0);
  });
});

describe("findBlocksReferencingBlockset with a sized tile", () => {
  it("measures the rect from the reference size", () => {
    const [result] = findBlocksReferencingBlockset(
      [makeBlock(1, { defaultTexture: { col: 1, row: 0, blocksetId: "t", size: 32 } })],
      shapeOf,
      "t",
      16
    );

    assert.deepEqual(result.rects, [
      {
        x: 16,
        y: 0,
        width: 32,
        height: 32
      }
    ]);
  });
});
