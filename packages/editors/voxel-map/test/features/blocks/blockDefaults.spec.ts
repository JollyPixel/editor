// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createBlockDefinition } from "../../../src/features/blocks/blockDefaults.ts";

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
