// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import {
  HOLE_BYTES,
  HOLE_TILE_BYTES
} from "#src/terrain/HoleMask.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { TileCoord } from "#src/terrain/TileCoord.ts";
import { ChunkTextureStore } from "#src/view/textures/ChunkTextureStore.ts";

// CONSTANTS
const kPyramidWidth = 128;
const kPyramidTexels = kPyramidWidth * 64;
const kLevelOffsets = [0, 64, 96, 112, 120, 124, 126];

function holeAt(
  quadX: number,
  quadZ: number
): Uint8Array {
  const holes = new Uint8Array(HOLE_BYTES);
  const index = quadZ * 64 + quadX;
  holes[index >> 3] = 1 << (index & 7);

  return holes;
}

function holeCells(
  store: ChunkTextureStore,
  coord: ChunkCoord,
  level: number
): string[] {
  const data = store.holes.image.data as Uint8Array;
  const layer = store.layer(coord)! * kPyramidTexels;
  const size = 64 >> level;
  const cells: string[] = [];
  for (let cellZ = 0; cellZ < size; cellZ++) {
    for (let cellX = 0; cellX < size; cellX++) {
      if (data[layer + cellZ * kPyramidWidth + kLevelOffsets[level] + cellX] !== 0) {
        cells.push(`${cellX},${cellZ}`);
      }
    }
  }

  return cells;
}

describe("ChunkTextureStore holes", () => {
  test("each level marks the cell over a hole quad, so any coarse cell holding one is dropped", () => {
    const terrain = new Terrain();
    const store = new ChunkTextureStore(terrain);
    const coord = new ChunkCoord(0, 0);
    terrain.addChunk(coord, undefined, undefined, holeAt(37, 5));
    store.chunkAdded(coord);

    assert.deepEqual(
      kLevelOffsets.map((_, level) => holeCells(store, coord, level)),
      [["37,5"], ["18,2"], ["9,1"], ["4,0"], ["2,0"], ["1,0"], ["0,0"]]
    );
  });

  test("filling a hole tile re-uploads only its chunk's layer", () => {
    const terrain = new Terrain();
    const store = new ChunkTextureStore(terrain);
    const coord = new ChunkCoord(0, 0);
    const neighbour = new ChunkCoord(1, 0);
    terrain.addChunk(coord, undefined, undefined, holeAt(3, 3));
    terrain.addChunk(neighbour, undefined, undefined, holeAt(3, 3));
    store.chunkAdded(coord);
    store.chunkAdded(neighbour);
    store.holes.clearLayerUpdates();

    const tile = TileCoord.fromIndex(coord, 0);
    terrain.writeHoleTile(tile, new Uint8Array(HOLE_TILE_BYTES));
    store.holesChanged([tile]);

    assert.deepEqual(holeCells(store, coord, 6), []);
    assert.deepEqual(holeCells(store, neighbour, 0), ["3,3"]);
    assert.deepEqual([...store.holes.layerUpdates], [store.layer(coord)]);
  });
});
