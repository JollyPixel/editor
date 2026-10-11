// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockShapeRegistry,
  type ResolvedBlockDefinition,
  type ResolvedTileRef,
  type TileRect
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TileOccupancy } from "../../../src/features/blocksets/TileOccupancy.ts";

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();
const kExtent = {
  width: 64,
  height: 64
};

function resolveShape(
  shapeId: string
) {
  return kShapes.get(shapeId);
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number
): TileRect {
  return { x, y, width, height };
}

function makeBlock(
  id: number,
  defaultTexture?: ResolvedTileRef,
  faceTextures: Record<string, ResolvedTileRef> = {}
): ResolvedBlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    faceTextures,
    defaultTexture,
    properties: {}
  };
}

describe("TileOccupancy", () => {
  it("collects the unique footprints of one blockset", () => {
    const blocks = [
      makeBlock(1, { col: 1, row: 0, blocksetId: "wood" }),
      makeBlock(2, { col: 1, row: 0, blocksetId: "wood" }),
      makeBlock(3, { col: 0, row: 0, blocksetId: "stone" })
    ];

    assert.deepEqual(
      TileOccupancy.collect(blocks, resolveShape, "wood", 16).rects,
      [rect(16, 0, 16, 16)]
    );
  });

  it("covers the span of a sloped face", () => {
    const ramp: ResolvedBlockDefinition = {
      ...makeBlock(1, undefined, {
        top: { col: 0, row: 1, blocksetId: "wood" }
      }),
      shapeId: "ramp"
    };

    assert.deepEqual(
      TileOccupancy.collect([ramp], resolveShape, "wood", 16).rects,
      [rect(0, 16, 16, 23)]
    );
  });

  it("returns the top-left tile of an empty blockset", () => {
    assert.deepEqual(new TileOccupancy(16, []).firstFree(16, kExtent), {
      col: 0,
      row: 0
    });
  });

  it("fits a region larger than one tile between occupied tiles", () => {
    const occupancy = new TileOccupancy(16, [rect(16, 0, 16, 16)]);

    assert.deepEqual(occupancy.firstFree(32, kExtent), {
      col: 2,
      row: 0
    });
  });

  it("falls back to the top-left tile of a full atlas", () => {
    const occupancy = new TileOccupancy(16, [rect(0, 0, 32, 32)]);

    assert.deepEqual(occupancy.firstFree(16, { width: 32, height: 32 }), {
      col: 0,
      row: 0
    });
  });
});
