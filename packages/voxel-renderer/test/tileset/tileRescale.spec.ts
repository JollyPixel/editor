// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  rescaleBlockTiles,
  rescaleLeavesBlocksOffGrid,
  rescaleTileRef
} from "../../src/tileset/index.ts";
import { resolveBlockDefinition } from "../../src/blocks/index.ts";

// CONSTANTS
const kRescale = {
  tilesetId: "a",
  from: 16,
  to: 32
};

describe("rescaleTileRef", () => {
  it("keeps the same texels on the new grid", () => {
    assert.deepEqual(rescaleTileRef({ tilesetId: "a", col: 2, row: 3 }, kRescale), {
      tilesetId: "a",
      col: 1,
      row: 1.5,
      size: 16
    });
  });

  it("keeps an explicit size", () => {
    const ref = rescaleTileRef({ tilesetId: "a", col: 2, row: 0, size: 8 }, kRescale);

    assert.equal(ref.size, 8);
  });

  it("returns references of other tilesets unchanged", () => {
    const ref = { tilesetId: "b", col: 1, row: 1 };

    assert.equal(rescaleTileRef(ref, kRescale), ref);
  });
});

describe("rescaleBlockTiles", () => {
  it("returns the block unchanged when it does not use the tileset", () => {
    const block = resolveBlockDefinition({
      id: 1,
      name: "b",
      shapeId: "cube",
      defaultTexture: { tilesetId: "b", col: 0, row: 0 }
    });

    assert.equal(rescaleBlockTiles(block, kRescale), block);
  });
});

describe("rescaleLeavesBlocksOffGrid", () => {
  it("reports references that leave the tile grid", () => {
    const onGrid = resolveBlockDefinition({
      id: 1,
      name: "on",
      shapeId: "cube",
      defaultTexture: { tilesetId: "a", col: 2, row: 4 }
    });
    const offGrid = resolveBlockDefinition({
      id: 2,
      name: "off",
      shapeId: "cube",
      defaultTexture: { tilesetId: "a", col: 1, row: 0 }
    });

    assert.equal(rescaleLeavesBlocksOffGrid([onGrid], kRescale), false);
    assert.equal(rescaleLeavesBlocksOffGrid([onGrid, offGrid], kRescale), true);
  });
});
