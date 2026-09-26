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
} from "../src/TileSet.ts";
import type { TiledMapTileset } from "../src/index.ts";
import { approxEqual } from "./helpers/math.ts";

function makeTileset(
  firstgid = 1,
  overrides: Partial<TiledMapTileset> = {}
): TileSet {
  return new TileSet({
    firstgid,
    name: "terrain",
    tilecount: 8,
    columns: 4,
    tilewidth: 16,
    tileheight: 16,
    source: "terrain.tsx",
    ...overrides
  });
}

describe("TileSet", () => {
  it("uses Tiled's three high flip bits", () => {
    assert.deepEqual(
      [FLIPPED_HORIZONTAL, FLIPPED_VERTICAL, FLIPPED_ANTI_DIAGONAL],
      [0x80000000, 0x40000000, 0x20000000]
    );
    assert.equal(TILED_FLIPPED_FLAGS, FLIPPED_HORIZONTAL | FLIPPED_VERTICAL | FLIPPED_ANTI_DIAGONAL);
  });

  it("derives its range and grid from the Tiled definition", () => {
    const tileset = makeTileset();

    assert.equal(tileset.name, "terrain");
    assert.equal(tileset.firstgid, 1);
    assert.equal(tileset.lastgid, 8);
    assert.equal(tileset.tilewidth, 16);
    assert.equal(tileset.tileheight, 16);
    assert.equal(tileset.columns, 4);
    assert.equal(tileset.rows, 2);
  });

  const kGids: [string, number, number, boolean][] = [
    ["the first tile", 1, 0, true],
    ["a middle tile", 4, 3, true],
    ["the last tile", 8, 7, true],
    ["a flipped tile", 3 | FLIPPED_HORIZONTAL, 2, true],
    ["a gid below the range", 0, -1, false],
    ["a gid past the range", 9, 8, false]
  ];

  for (const [name, gid, localId, contained] of kGids) {
    it(`maps ${name} to local id ${localId}`, () => {
      const tileset = makeTileset();

      assert.equal(tileset.getTileLocalId(gid), localId);
      assert.equal(tileset.containsLocalId(localId), contained);
      assert.equal(tileset.containsGid(gid), contained);
    });
  }
});

describe("TileSet.getTileProperties", () => {
  const kTiles: [number, number, number, number, number][] = [
    [1, 0, 0, 0, 0.5],
    [2, 1, 0, 0.25, 0.5],
    [5, 0, 1, 0, 0],
    [7, 2, 1, 0.5, 0]
  ];

  for (const [gid, col, row, offsetU, offsetV] of kTiles) {
    it(`places gid ${gid} at column ${col}, row ${row} with a Y-flipped uv`, () => {
      const props = makeTileset().getTileProperties(gid);
      assert.ok(props !== null);

      assert.deepEqual([props.coords.x, props.coords.y], [col, row]);
      assert.ok(approxEqual(props.uv.offset.x, offsetU));
      assert.ok(approxEqual(props.uv.offset.y, offsetV));
      assert.ok(approxEqual(props.uv.size.x, 1 / 4));
      assert.ok(approxEqual(props.uv.size.y, 1 / 2));
    });
  }

  it("returns null for a gid outside the tileset", () => {
    const tileset = makeTileset();

    assert.equal(tileset.getTileProperties(99), null);
    assert.equal(tileset.getTileProperties(0), null);
  });

  it("decodes the flip bits", () => {
    const props = makeTileset().getTileProperties(1 | FLIPPED_HORIZONTAL | FLIPPED_ANTI_DIAGONAL);
    assert.ok(props !== null);

    assert.deepEqual(
      [props.flippedX, props.flippedY, props.flippedAD],
      [true, false, true]
    );
  });
});

describe("TileSet.find", () => {
  const first = makeTileset(1);
  const second = makeTileset(9, { name: "walls", tilecount: 4, columns: 2 });

  it("returns the tileset whose range holds the gid, whatever the order", () => {
    assert.equal(TileSet.find([first, second], 10), second);
    assert.equal(TileSet.find([second, first], 3), first);
    assert.equal(TileSet.find([first], 5), first);
  });

  it("returns null when no tileset contains the gid", () => {
    assert.equal(TileSet.find([makeTileset(10)], 1), null);
  });
});
