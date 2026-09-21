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
  assignBlockTileset,
  blockFocusTilesetId,
  blocksWithoutTileset,
  blockTilesetStatus,
  blockTileSize,
  countBlocksPerTileset,
  firstFreeTile,
  occupiedTileRects,
  rescaleLeavesBlocksOffGrid,
  resizeBlockTiles,
  type TilesetAssignment,
  type TilesetGrid
} from "../../../src/features/tilesets/blockTilesets.ts";

// CONSTANTS
const kKnown = new Set(["stone", "wood"]);
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

describe("blockTilesetStatus", () => {
  it("is assigned when every reference uses one known tileset", () => {
    const block = makeBlock(1, { col: 0, row: 0, tilesetId: "stone" });

    assert.deepEqual(blockTilesetStatus(block, kKnown), {
      kind: "assigned",
      tilesetId: "stone"
    });
  });

  it("is missing when a reference has no tileset", () => {
    const block = makeBlock(1, { col: 0, row: 0 });

    assert.deepEqual(blockTilesetStatus(block, kKnown), {
      kind: "missing",
      tilesetIds: []
    });
  });

  it("is mixed when references use several known tilesets", () => {
    const block = makeBlock(
      1,
      { col: 0, row: 0, tilesetId: "stone" },
      { top: { col: 0, row: 0, tilesetId: "wood" } }
    );

    assert.equal(blockTilesetStatus(block, kKnown).kind, "mixed");
  });

  it("is missing when any reference points at an unknown tileset", () => {
    const block = makeBlock(
      1,
      { col: 0, row: 0, tilesetId: "stone" },
      { top: { col: 0, row: 0, tilesetId: "removed" } }
    );

    assert.deepEqual(blockTilesetStatus(block, kKnown), {
      kind: "missing",
      tilesetIds: ["removed", "stone"]
    });
  });

  it("is none for a block without texture", () => {
    assert.deepEqual(blockTilesetStatus(makeBlock(1), kKnown), {
      kind: "none"
    });
  });
});

describe("blockFocusTilesetId", () => {
  it("is the tileset of an assigned block", () => {
    const block = makeBlock(1, { col: 0, row: 0, tilesetId: "wood" });

    assert.equal(blockFocusTilesetId(block, kKnown), "wood");
  });

  it("is the first referenced tileset of a mixed block", () => {
    const block = makeBlock(
      1,
      { col: 0, row: 0, tilesetId: "stone" },
      { top: { col: 0, row: 0, tilesetId: "wood" } }
    );

    assert.equal(blockFocusTilesetId(block, kKnown), "wood");
  });

  it("is null for a block with a missing tileset or no texture", () => {
    const missing = makeBlock(1, { col: 0, row: 0, tilesetId: "glass" });

    assert.equal(blockFocusTilesetId(missing, kKnown), null);
    assert.equal(blockFocusTilesetId(makeBlock(2), kKnown), null);
  });
});

describe("countBlocksPerTileset and blocksWithoutTileset", () => {
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

  it("lists the blocks whose tileset is missing", () => {
    assert.deepEqual(
      blocksWithoutTileset(blocks, kKnown).map(({ id }) => id),
      [3]
    );
  });
});

describe("assignBlockTileset", () => {
  function assign(
    block: ResolvedBlockDefinition,
    tilesetId: string,
    options: Pick<TilesetAssignment, "occupied" | "shape"> = {}
  ): ResolvedBlockDefinition {
    return assignBlockTileset(block, {
      tilesetId,
      target: kGrids[tilesetId],
      sourceOf: (id) => (id === undefined ? undefined : kGrids[id]),
      ...options
    });
  }

  it("starts at the top-left tile of an empty tileset and keeps the area", () => {
    const block = makeBlock(1, { col: 1, row: 2, tilesetId: "wood" });

    assert.deepEqual(assign(block, "stone").defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "stone",
      size: 16
    });
  });

  it("keeps an implicit size when the tile size matches", () => {
    const block = makeBlock(1, { col: 1, row: 1, tilesetId: "gone" });

    assert.deepEqual(assign(block, "wood").defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "wood"
    });
  });

  it("skips the tiles other blocks occupy", () => {
    const block = makeBlock(1, { col: 3, row: 3, tilesetId: "brick" });
    const assigned = assign(block, "wood", {
      occupied: [rect(0, 0, 16, 16)]
    });

    assert.deepEqual(assigned.defaultTexture, {
      col: 1,
      row: 0,
      tilesetId: "wood"
    });
  });

  it("moves to the next row once a row is full", () => {
    const block = makeBlock(1, { col: 3, row: 3, tilesetId: "brick" });
    const assigned = assign(block, "wood", {
      occupied: [rect(0, 0, 64, 16)]
    });

    assert.deepEqual(assigned.defaultTexture, {
      col: 0,
      row: 1,
      tilesetId: "wood"
    });
  });

  it("falls back to the top-left tile when the atlas is full", () => {
    const block = makeBlock(1, { col: 3, row: 3, tilesetId: "brick" });
    const assigned = assign(block, "wood", {
      occupied: [rect(0, 0, 64, 64)]
    });

    assert.deepEqual(assigned.defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "wood"
    });
  });

  it("keeps the faces of a block in their relative layout", () => {
    const block = makeBlock(
      1,
      { col: 2, row: 1, tilesetId: "brick" },
      { top: { col: 3, row: 2, tilesetId: "brick" } }
    );
    const assigned = assign(block, "wood", {
      occupied: [rect(0, 0, 16, 16)]
    });

    assert.deepEqual(assigned.defaultTexture, {
      col: 1,
      row: 0,
      tilesetId: "wood"
    });
    assert.deepEqual(assigned.faceTextures.top, {
      col: 2,
      row: 1,
      tilesetId: "wood"
    });
  });

  it("keeps faces sharing a tile on the same tile", () => {
    const block = makeBlock(
      1,
      { col: 2, row: 1, tilesetId: "brick" },
      { top: { col: 2, row: 1, tilesetId: "brick" } }
    );
    const assigned = assign(block, "wood", {
      occupied: [rect(0, 0, 16, 16)]
    });

    assert.deepEqual(assigned.faceTextures.top, assigned.defaultTexture);
    assert.equal(assigned.defaultTexture?.col, 1);
  });

  it("lays the faces out on the target grid when offsets leave it", () => {
    const block = makeBlock(
      1,
      { col: 2, row: 0, tilesetId: "wood" },
      { top: { col: 1, row: 0, tilesetId: "wood" } }
    );
    const assigned = assign(block, "stone");

    assert.deepEqual(assigned.faceTextures.top, {
      col: 0,
      row: 0,
      tilesetId: "stone",
      size: 16
    });
    assert.deepEqual(assigned.defaultTexture, {
      col: 1,
      row: 0,
      tilesetId: "stone",
      size: 16
    });
  });

  it("leaves the slots already assigned and places around them", () => {
    const top = { col: 0, row: 0, tilesetId: "stone" };
    const block = makeBlock(
      1,
      { col: 2, row: 0, tilesetId: "wood" },
      { top }
    );
    const assigned = assign(block, "stone");

    assert.equal(assigned.faceTextures.top, top);
    assert.deepEqual(assigned.defaultTexture, {
      col: 1,
      row: 0,
      tilesetId: "stone",
      size: 16
    });
  });

  it("reserves the span of a sloped face", () => {
    const block = makeBlock(
      1,
      { col: 1, row: 0, tilesetId: "brick" },
      { top: { col: 0, row: 0, tilesetId: "brick" } }
    );
    const assigned = assign(block, "wood", {
      shape: kShapes.get("ramp"),
      occupied: [rect(0, 16, 64, 16)]
    });

    assert.equal(assigned.faceTextures.top.row, 2);
    assert.equal(assigned.defaultTexture?.row, 2);
  });

  it("returns the block untouched when every slot is already assigned", () => {
    const block = makeBlock(1, { col: 1, row: 1, tilesetId: "wood" });

    assert.equal(assign(block, "wood"), block);
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
