// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockShapeRegistry,
  BlockTextureLayout,
  resolveBlockDefinition,
  type BlockDefinition
} from "../../../src/document/blocks/index.ts";

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();

function layoutOf(
  patch: Partial<BlockDefinition>
): BlockTextureLayout {
  const block = resolveBlockDefinition({
    id: 1,
    name: "Block",
    shapeId: "cube",
    ...patch
  });

  return BlockTextureLayout.of(block, kShapes.get(block.shapeId));
}

describe("BlockTextureLayout", () => {
  it("has no slot without a shape", () => {
    const layout = layoutOf({
      shapeId: "missing",
      defaultTexture: { blocksetId: "atlas", col: 0, row: 0 }
    });

    assert.deepEqual(layout.slots, []);
    assert.equal(layout.usesBlockset("atlas"), false);
    assert.deepEqual(layout.drawnRectsIn("atlas", 16), []);
  });

  it("uses the blocksets its slots sample", () => {
    const layout = layoutOf({
      defaultTexture: { blocksetId: "other", col: 0, row: 0 },
      faceTextures: { top: { blocksetId: "atlas", col: 2, row: 1 } }
    });

    assert.equal(layout.usesBlockset("atlas"), true);
    assert.equal(layout.usesBlockset("third"), false);
    assert.deepEqual(layout.slotsIn("atlas").map(({ slot }) => slot), ["top"]);
  });

  it("collects the unique rects its slots draw from a blockset", () => {
    const layout = layoutOf({
      defaultTexture: { blocksetId: "atlas", col: 0, row: 0 },
      faceTextures: {
        top: { blocksetId: "atlas", col: 1, row: 0 },
        bottom: { blocksetId: "other", col: 5, row: 5 }
      }
    });

    assert.deepEqual(layout.drawnRectsIn("atlas", 16), [
      { x: 0, y: 0, width: 16, height: 16 },
      { x: 16, y: 0, width: 16, height: 16 }
    ]);
  });

  it("measures a drawn rect from the reference size", () => {
    const layout = layoutOf({
      defaultTexture: { blocksetId: "t", col: 1, row: 0, size: 32 }
    });

    assert.deepEqual(layout.drawnRectsIn("t", 16), [
      { x: 16, y: 0, width: 32, height: 32 }
    ]);
  });

  it("reserves whole tiles, stretched by a sloped face, as footprints", () => {
    const ramp = layoutOf({
      shapeId: "ramp",
      faceTextures: { top: { blocksetId: "wood", col: 0, row: 1 } }
    });
    const cube = layoutOf({
      defaultTexture: { blocksetId: "wood", col: 1, row: 0 }
    });

    assert.deepEqual(ramp.footprintsIn("wood", 16), [
      { x: 0, y: 16, width: 16, height: 23 }
    ]);
    assert.deepEqual(cube.footprintsIn("wood", 16), [
      { x: 16, y: 0, width: 16, height: 16 }
    ]);
    assert.deepEqual(cube.footprintsIn("stone", 16), []);
  });
});
