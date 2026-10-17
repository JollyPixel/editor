// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  composeBlockId,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlocksetEntry } from "../../../../src/features/blocksets/BlocksetEntry.ts";
import { BlockLibraryScope } from "../../../../src/features/blocks/library/BlockLibraryScope.ts";

// CONSTANTS
const kStone = new BlocksetEntry({ id: "stone", slot: 1 }, null, "stone");

function block(
  slot: number,
  name: string
): ResolvedBlockDefinition {
  return {
    id: composeBlockId(slot, 1),
    name,
    shapeId: "cube",
    faceTextures: {},
    collidable: true,
    properties: {}
  };
}

describe("BlockLibraryScope", () => {
  const stone = block(1, "stone");
  const wood = block(2, "wood");

  it("parses a stored scope and falls back to every blockset", () => {
    assert.equal(BlockLibraryScope.parse("active"), BlockLibraryScope.Active);
    assert.equal(BlockLibraryScope.parse("all"), BlockLibraryScope.All);
    assert.equal(BlockLibraryScope.parse("usage"), BlockLibraryScope.All);
    assert.equal(BlockLibraryScope.parse(null), BlockLibraryScope.All);
  });

  it("includes every blockset's blocks unless scoped to the active one", () => {
    assert.equal(BlockLibraryScope.All.includes(wood, kStone), true);
    assert.equal(BlockLibraryScope.Active.includes(wood, undefined), true);
    assert.equal(BlockLibraryScope.Active.includes(stone, kStone), true);
    assert.equal(BlockLibraryScope.Active.includes(wood, kStone), false);
  });
});
