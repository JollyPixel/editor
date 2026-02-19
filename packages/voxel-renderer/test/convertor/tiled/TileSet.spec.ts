// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TileSet,
  FLIPPED_HORIZONTAL,
  FLIPPED_VERTICAL,
  FLIPPED_ANTI_DIAGONAL,
  TILED_FLIPPED_FLAGS
} from "../../../src/convertor/tiled/TileSet.ts";

// CONSTANTS
const kEpsilon = 1e-10;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < kEpsilon;
}

// A 4-column, 2-row tileset starting at GID 1 (8 tiles total)
function makeTileset(firstgid = 1) {
  return new TileSet({
    firstgid,
    name: "terrain",
    tilecount: 8,
    columns: 4,
    tilewidth: 16,
    tileheight: 16,
    source: "terrain.tsx"
  } as any);
}

describe("TileSet constants", () => {
  it("FLIPPED_HORIZONTAL is bit 31", () => {
    assert.equal(FLIPPED_HORIZONTAL, 0x80000000);
  });

  it("FLIPPED_VERTICAL is bit 30", () => {
    assert.equal(FLIPPED_VERTICAL, 0x40000000);
  });

  it("FLIPPED_ANTI_DIAGONAL is bit 29", () => {
    assert.equal(FLIPPED_ANTI_DIAGONAL, 0x20000000);
  });

  it("TILED_FLIPPED_FLAGS is OR of all three", () => {
    assert.equal(TILED_FLIPPED_FLAGS, FLIPPED_HORIZONTAL | FLIPPED_VERTICAL | FLIPPED_ANTI_DIAGONAL);
  });
});

describe("TileSet getters", () => {
  const ts = makeTileset();

  it("name", () => {
    assert.equal(ts.name, "terrain");
  });

  it("firstgid", () => {
    assert.equal(ts.firstgid, 1);
  });

  it("lastgid = firstgid + tilecount - 1", () => {
    assert.equal(ts.lastgid, 8);
  });

  it("tilewidth / tileheight", () => {
    assert.equal(ts.tilewidth, 16);
    assert.equal(ts.tileheight, 16);
  });

  it("columns", () => {
    assert.equal(ts.columns, 4);
  });

  it("rows = tilecount / columns", () => {
    assert.equal(ts.rows, 2);
  });
});

describe("TileSet.getTileLocalId", () => {
  const ts = makeTileset(1);

  it("GID 1 → local 0", () => {
    assert.equal(ts.getTileLocalId(1), 0);
  });

  it("GID 4 → local 3", () => {
    assert.equal(ts.getTileLocalId(4), 3);
  });

  it("strips flip bits before subtracting firstgid", () => {
    const gidWithFlip = 3 | FLIPPED_HORIZONTAL;
    assert.equal(ts.getTileLocalId(gidWithFlip), 2);
  });

  it("GID less than firstgid gives negative local id", () => {
    assert.equal(ts.getTileLocalId(0), -1);
  });
});

describe("TileSet.containsLocalId", () => {
  const ts = makeTileset();

  it("0 is inside (first tile)", () => {
    assert.equal(ts.containsLocalId(0), true);
  });

  it("7 is inside (last tile of 8)", () => {
    assert.equal(ts.containsLocalId(7), true);
  });

  it("8 is outside", () => {
    assert.equal(ts.containsLocalId(8), false);
  });

  it("-1 is outside", () => {
    assert.equal(ts.containsLocalId(-1), false);
  });
});

describe("TileSet.containsGid", () => {
  const ts = makeTileset(1);

  it("GID 1 (first tile) is contained", () => {
    assert.equal(ts.containsGid(1), true);
  });

  it("GID 8 (last tile) is contained", () => {
    assert.equal(ts.containsGid(8), true);
  });

  it("GID 0 is not contained", () => {
    assert.equal(ts.containsGid(0), false);
  });

  it("GID 9 is not contained", () => {
    assert.equal(ts.containsGid(9), false);
  });

  it("GID with flip bits is still contained if base GID is in range", () => {
    assert.equal(ts.containsGid(3 | FLIPPED_HORIZONTAL), true);
  });
});

describe("TileSet.getTileProperties — UV math", () => {
  // 4 cols, 2 rows, tileSize 16 → image is 64×32
  const ts = makeTileset(1);

  it("first tile (GID=1, local=0) → col=0, row=0", () => {
    const props = ts.getTileProperties(1);
    assert.ok(props !== null);
    assert.equal(props!.coords.x, 0);
    assert.equal(props!.coords.y, 0);
  });

  it("GID=2 (local=1) → col=1, row=0", () => {
    const props = ts.getTileProperties(2);
    assert.ok(props !== null);
    assert.equal(props!.coords.x, 1);
    assert.equal(props!.coords.y, 0);
  });

  it("GID=5 (local=4) → col=0, row=1", () => {
    const props = ts.getTileProperties(5);
    assert.ok(props !== null);
    assert.equal(props!.coords.x, 0);
    assert.equal(props!.coords.y, 1);
  });

  it("UV size is 1/cols × 1/rows", () => {
    const props = ts.getTileProperties(1)!;
    assert.ok(approxEqual(props.uv.size.x, 1 / 4));
    assert.ok(approxEqual(props.uv.size.y, 1 / 2));
  });

  it("UV offset for (col=0, row=0) → offsetU=0, offsetV=0.5 (Y-flipped)", () => {
    // Y-flip: offsetV = 1 - (row+1)/rows = 1 - 1/2 = 0.5
    const props = ts.getTileProperties(1)!;
    assert.ok(approxEqual(props.uv.offset.x, 0));
    assert.ok(approxEqual(props.uv.offset.y, 0.5));
  });

  it("UV offset for (col=2, row=1) → offsetU=0.5, offsetV=0", () => {
    // col=2 → offsetU = 2/4 = 0.5
    // row=1 → offsetV = 1 - (1+1)/2 = 0
    const props = ts.getTileProperties(7)!;
    assert.ok(approxEqual(props.uv.offset.x, 0.5));
    assert.ok(approxEqual(props.uv.offset.y, 0));
  });

  it("returns null for GID outside tileset range", () => {
    assert.equal(ts.getTileProperties(99), null);
    assert.equal(ts.getTileProperties(0), null);
  });

  it("flip bits are correctly decoded", () => {
    const gid = 1 | FLIPPED_HORIZONTAL | FLIPPED_ANTI_DIAGONAL;
    const props = ts.getTileProperties(gid)!;
    assert.equal(props.flippedX, true);
    assert.equal(props.flippedY, false);
    assert.equal(props.flippedAD, true);
  });
});

describe("TileSet.find", () => {
  it("returns the tileset containing the GID", () => {
    // GIDs 1–8
    const ts1 = makeTileset(1);
    const ts2 = new TileSet({ firstgid: 9, name: "walls", tilecount: 4, columns: 2, tilewidth: 16, tileheight: 16 } as any);
    const found = TileSet.find([ts1, ts2], 10);
    assert.equal(found, ts2);
  });

  it("returns the first tileset for GIDs in its range", () => {
    const ts1 = makeTileset(1);
    const ts2 = new TileSet({ firstgid: 9, name: "walls", tilecount: 4, columns: 2, tilewidth: 16, tileheight: 16 } as any);
    // Deliberately unordered input
    const found = TileSet.find([ts2, ts1], 3);
    assert.equal(found, ts1);
  });

  it("returns null when no tileset contains the GID", () => {
    // GIDs 10–17
    const ts = makeTileset(10);
    assert.equal(TileSet.find([ts], 1), null);
  });

  it("works with a single tileset", () => {
    const ts = makeTileset(1);
    assert.equal(TileSet.find([ts], 5), ts);
  });
});
