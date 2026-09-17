// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  assignBlockTileset,
  blocksWithoutTileset,
  blockTilesetStatus,
  blockTileSize,
  countBlocksPerTileset,
  resizeBlockTiles,
  type TilesetGrid
} from "../../../src/features/tilesets/blockTilesets.ts";

// CONSTANTS
const kKnown = new Set(["stone", "wood"]);
const kGrids: Record<string, TilesetGrid> = {
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
    tilesetId: string
  ): ResolvedBlockDefinition {
    return assignBlockTileset(block, {
      tilesetId,
      target: kGrids[tilesetId],
      sourceOf: (id) => (id === undefined ? undefined : kGrids[id])
    });
  }

  it("keeps the pixel position and area when the tile size differs", () => {
    const block = makeBlock(1, { col: 1, row: 2, tilesetId: "wood" });

    assert.deepEqual(assign(block, "stone").defaultTexture, {
      col: 0.5,
      row: 1,
      tilesetId: "stone",
      size: 16
    });
  });

  it("keeps an implicit size when the tile size matches", () => {
    const block = makeBlock(1, { col: 1, row: 1, tilesetId: "gone" });

    assert.deepEqual(assign(block, "wood").defaultTexture, {
      col: 1,
      row: 1,
      tilesetId: "wood"
    });
  });

  it("clamps the region inside the target atlas", () => {
    const block = makeBlock(1, { col: 3, row: 3, tilesetId: "stone" });

    assert.deepEqual(assign(block, "wood").defaultTexture, {
      col: 2,
      row: 2,
      tilesetId: "wood",
      size: 32
    });
  });

  it("moves every slot and leaves the ones already assigned", () => {
    const top = { col: 1, row: 0, tilesetId: "stone" };
    const block = makeBlock(
      1,
      { col: 2, row: 0, tilesetId: "wood" },
      { top }
    );
    const assigned = assign(block, "stone");

    assert.equal(assigned.faceTextures.top, top);
    assert.equal(assigned.defaultTexture?.tilesetId, "stone");
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
