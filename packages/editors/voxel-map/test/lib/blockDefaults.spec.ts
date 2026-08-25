// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { BlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  createBlockDefinition,
  nextBlockId
} from "../../src/lib/blockDefaults.ts";

function makeBlock(
  id: number
): BlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures: {}
  };
}

describe("nextBlockId", () => {
  it("returns one for an empty registry, never zero (air)", () => {
    assert.equal(nextBlockId([]), 1);
  });

  it("sits above the highest identifier, whatever the order", () => {
    assert.equal(
      nextBlockId([makeBlock(4), makeBlock(9), makeBlock(2)]),
      10
    );
  });

  it("does not reuse a gap left by a removed block", () => {
    assert.equal(nextBlockId([makeBlock(1), makeBlock(3)]), 4);
  });
});

describe("createBlockDefinition", () => {
  it("lands on the first tile of the given tileset, collidable and opaque", () => {
    const block = createBlockDefinition({
      id: 3,
      name: "Grass",
      shapeId: "ramp",
      tilesetId: "atlas"
    });

    assert.deepEqual(block, {
      id: 3,
      name: "Grass",
      shapeId: "ramp",
      collidable: true,
      faceTextures: {},
      defaultTexture: {
        tilesetId: "atlas",
        col: 0,
        row: 0
      }
    });
  });

  it("falls back to a cube and leaves the tileset for the engine to resolve", () => {
    const block = createBlockDefinition({
      id: 1,
      name: "New Block"
    });

    assert.equal(block.shapeId, "cube");
    assert.equal(block.defaultTexture!.tilesetId, undefined);
  });
});
