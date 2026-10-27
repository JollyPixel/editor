// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import {
  SPLAT_CHANNELS,
  SPLAT_TEXEL_COUNT,
  SPLAT_TILE_TEXEL_COUNT,
  SplatMap,
  uniformSplat
} from "#src/terrain/SplatMap.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { TileCoord } from "#src/terrain/TileCoord.ts";

function uniformTile(
  slot: number
) {
  return uniformSplat(SPLAT_TILE_TEXEL_COUNT, slot);
}

describe("SplatMap", () => {
  test("a written tile reads back and leaves its neighbours as they were", () => {
    const splat = new SplatMap();
    splat.writeTile(1, 2, uniformTile(5));

    assert.deepEqual(splat.tile(1, 2), uniformTile(5));
    assert.deepEqual(splat.tile(2, 2), uniformTile(0));
    assert.equal(splat.dominantSlot(32, 64), 5);
    assert.equal(splat.dominantSlot(31, 64), 0);
  });

  test("texels whose weights do not sum to 255 are refused", () => {
    const tile = uniformTile(3);
    tile.weights[SPLAT_CHANNELS + 1] = 1;

    assert.throws(() => new SplatMap().writeTile(0, 0, tile), RangeError);
    assert.throws(() => new SplatMap({
      indices: new Uint8Array(SPLAT_TEXEL_COUNT * SPLAT_CHANNELS),
      weights: new Uint8Array(SPLAT_TEXEL_COUNT * SPLAT_CHANNELS)
    }), RangeError);
  });

  test("the dominant slot is the one with the highest weight", () => {
    const tile = uniformTile(0);
    tile.indices.set([2, 7, 9, 4], 0);
    tile.weights.set([60, 120, 50, 25], 0);
    const splat = new SplatMap();
    splat.writeTile(0, 0, tile);

    assert.equal(splat.dominantSlot(0, 0), 7);
  });
});

describe("Terrain splat", () => {
  test("the overview keeps each 32 m point's dominant material as tiles are painted", () => {
    const terrain = new Terrain();
    const coord = new ChunkCoord(0, 0);
    terrain.addChunk(coord);

    terrain.writeSplatTile(TileCoord.fromIndex(coord, 2), uniformTile(3));
    terrain.writeSplatTile(TileCoord.fromIndex(coord, 1), uniformTile(6));

    assert.deepEqual([...terrain.overview.materials(coord)!], [0, 3, 0, 0]);
  });

  test("a chunk loaded from its heights keeps the overview's materials until its splat loads", () => {
    const terrain = new Terrain();
    const coord = new ChunkCoord(0, 0);
    terrain.addUnloadedChunk(coord, new Float32Array(4), new Uint8Array([4, 4, 2, 2]));
    terrain.writeOverviewSplatTile(TileCoord.fromIndex(coord, 0), uniformTile(8));

    terrain.loadChunk(coord, new Float32Array(64 * 64));
    assert.deepEqual([...terrain.overview.materials(coord)!], [8, 4, 2, 2]);

    terrain.loadSplat(coord, uniformSplat(SPLAT_TEXEL_COUNT, 1));
    assert.deepEqual([...terrain.overview.materials(coord)!], [1, 1, 1, 1]);
  });
});
