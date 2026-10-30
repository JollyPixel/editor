// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import {
  HOLE_BYTES,
  HOLE_TILE_BYTES,
  HoleMask
} from "#src/terrain/HoleMask.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { TileCoord } from "#src/terrain/TileCoord.ts";

function tileWithHole(
  quadX: number,
  quadZ: number
): Uint8Array {
  const bits = new Uint8Array(HOLE_TILE_BYTES);
  const index = quadZ * 16 + quadX;
  bits[index >> 3] = 1 << (index & 7);

  return bits;
}

describe("HoleMask", () => {
  test("a written tile marks the quads under it and reads back", () => {
    const holes = new HoleMask();
    holes.writeTile(1, 2, tileWithHole(9, 3));

    assert.equal(holes.isHole(16 + 9, 32 + 3), true);
    assert.equal(holes.isHole(16 + 8, 32 + 3), false);
    assert.equal(holes.isHole(9, 3), false);
    assert.deepEqual(holes.tile(1, 2), tileWithHole(9, 3));
    assert.deepEqual(holes.tile(2, 2), new Uint8Array(HOLE_TILE_BYTES));
    assert.equal(holes.empty, false);
  });

  test("masks and tiles of the wrong size are refused", () => {
    assert.throws(() => new HoleMask(new Uint8Array(HOLE_BYTES - 1)), RangeError);
    assert.throws(() => new HoleMask().writeTile(0, 0, new Uint8Array(HOLE_TILE_BYTES + 1)), RangeError);
  });
});

describe("Terrain holes", () => {
  test("writing a hole tile returns the bits it replaced", () => {
    const terrain = new Terrain();
    const tile = TileCoord.fromIndex(new ChunkCoord(0, 0), 5);
    terrain.addChunk(tile.chunk);

    const previous = terrain.writeHoleTile(tile, tileWithHole(0, 0));

    assert.deepEqual(previous, new Uint8Array(HOLE_TILE_BYTES));
    assert.deepEqual(terrain.writeHoleTile(tile, new Uint8Array(HOLE_TILE_BYTES)), tileWithHole(0, 0));
    assert.equal(terrain.chunk(tile.chunk)!.holes.empty, true);
  });

  test("a chunk whose holes loaded first keeps them when its heights load after", () => {
    const terrain = new Terrain();
    const coord = new ChunkCoord(0, 0);
    terrain.addChunk(coord);
    const holes = new Uint8Array(HOLE_BYTES);
    holes[HOLE_BYTES - 1] = 0x80;
    terrain.loadHoles(coord, holes);

    terrain.loadChunk(coord, new Float32Array(64 * 64).fill(7));

    assert.equal(terrain.chunk(coord)!.holes.isHole(63, 63), true);
    assert.equal(terrain.sampleAt(10, 10), 7);
  });
});
