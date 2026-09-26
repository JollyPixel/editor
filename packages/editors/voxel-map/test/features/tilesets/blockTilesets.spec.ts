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
import {
  blockTileSize,
  countBlocksPerTileset,
  firstFreeTile,
  occupiedTileRects,
  rescaleLeavesBlocksOffGrid,
  resizeBlockTiles,
  type TilesetGrid
} from "../../../src/features/tilesets/blockTilesets.ts";

// CONSTANTS
const kShapes = BlockShapeRegistry.createDefault();
const kGrids: Record<string, TilesetGrid> = {
  brick: {
    tileSize: 16,
    width: 64,
    height: 64
  },
  stone: {
    tileSize: 32,
    width: 128,
    height: 128
  },
  wood: {
    tileSize: 16,
    width: 64,
    height: 64
  }
};

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

describe("countBlocksPerTileset", () => {
  const blocks = [
    makeBlock(1, { col: 0, row: 0, tilesetId: "stone" }),
    makeBlock(2, { col: 0, row: 0, tilesetId: "stone" }),
    makeBlock(3, { col: 0, row: 0, tilesetId: "gone" })
  ];

  it("counts each block once per tileset it uses", () => {
    assert.deepEqual(
      [...countBlocksPerTileset(blocks)],
      [
        ["stone", 2],
        ["gone", 1]
      ]
    );
  });
});

describe("occupiedTileRects", () => {
  it("collects the unique footprints of one tileset", () => {
    const blocks = [
      makeBlock(1, { col: 1, row: 0, tilesetId: "wood" }),
      makeBlock(2, { col: 1, row: 0, tilesetId: "wood" }),
      makeBlock(3, { col: 0, row: 0, tilesetId: "stone" })
    ];

    assert.deepEqual(
      occupiedTileRects(blocks, (id) => kShapes.get(id), "wood", 16),
      [rect(16, 0, 16, 16)]
    );
  });

  it("covers the span of a sloped face", () => {
    const ramp: ResolvedBlockDefinition = {
      ...makeBlock(1, undefined, {
        top: { col: 0, row: 1, tilesetId: "wood" }
      }),
      shapeId: "ramp"
    };

    assert.deepEqual(
      occupiedTileRects([ramp], (id) => kShapes.get(id), "wood", 16),
      [rect(0, 16, 16, 23)]
    );
  });
});

describe("firstFreeTile", () => {
  it("returns the top-left tile of an empty tileset", () => {
    assert.deepEqual(firstFreeTile(kGrids.wood, 16, []), {
      col: 0,
      row: 0
    });
  });

  it("fits a region larger than one tile between occupied tiles", () => {
    const position = firstFreeTile(kGrids.wood, 32, [rect(16, 0, 16, 16)]);

    assert.deepEqual(position, {
      col: 2,
      row: 0
    });
  });
});

describe("resizeBlockTiles", () => {
  it("sets the size on every reference", () => {
    const block = resizeBlockTiles(
      makeBlock(
        1,
        { col: 0, row: 0, tilesetId: "stone" },
        { top: { col: 1, row: 0, tilesetId: "stone" } }
      ),
      64
    );

    assert.equal(block.defaultTexture?.size, 64);
    assert.equal(block.faceTextures.top.size, 64);
    assert.equal(blockTileSize(block), 64);
  });

  it("reads no size from a block that has none", () => {
    assert.equal(blockTileSize(makeBlock(1, { col: 0, row: 0 })), undefined);
    assert.equal(blockTileSize(makeBlock(1)), undefined);
  });
});

describe("rescaleLeavesBlocksOffGrid", () => {
  const rescale = {
    tilesetId: "stone",
    from: 16,
    to: 32
  };

  it("reports references that leave the tile grid", () => {
    const onGrid = makeBlock(1, { tilesetId: "stone", col: 2, row: 4 });
    const offGrid = makeBlock(2, undefined, {
      top: { tilesetId: "stone", col: 1, row: 0 }
    });
    const otherTileset = makeBlock(3, { tilesetId: "wood", col: 1, row: 1 });

    assert.equal(rescaleLeavesBlocksOffGrid([onGrid, otherTileset], rescale), false);
    assert.equal(rescaleLeavesBlocksOffGrid([onGrid, offGrid], rescale), true);
  });
});
