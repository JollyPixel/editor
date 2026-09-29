// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockLibraryOrder } from "../../../../src/features/blocks/library/BlockLibraryOrder.ts";

function block(
  id: number
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block ${id}`,
    shapeId: "cube",
    faceTextures: {},
    collidable: true,
    properties: {}
  };
}

describe("BlockLibraryOrder", () => {
  it("parses a stored order and falls back to the registry order", () => {
    assert.equal(BlockLibraryOrder.parse("usage"), BlockLibraryOrder.Usage);
    assert.equal(BlockLibraryOrder.parse("registry"), BlockLibraryOrder.Registry);
    assert.equal(BlockLibraryOrder.parse("true"), BlockLibraryOrder.Registry);
    assert.equal(BlockLibraryOrder.parse(null), BlockLibraryOrder.Registry);
  });

  it("only lets the registry order be reordered by dragging", () => {
    assert.equal(BlockLibraryOrder.Registry.reorderable, true);
    assert.equal(BlockLibraryOrder.Usage.reorderable, false);
  });

  it("keeps the registry array as is", () => {
    const blocks = [block(1), block(2), block(3)];

    assert.equal(BlockLibraryOrder.Registry.apply(blocks, new Map()), blocks);
  });

  it("sorts by descending usage and keeps registry order on ties", () => {
    const blocks = [block(1), block(2), block(3), block(4)];
    const counts = new Map([[2, 5], [3, 9], [4, 5]]);

    assert.deepEqual(
      BlockLibraryOrder.Usage.apply(blocks, counts).map(({ id }) => id),
      [3, 2, 4, 1]
    );
    assert.deepEqual(blocks.map(({ id }) => id), [1, 2, 3, 4]);
  });
});
