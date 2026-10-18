// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  APRON_MARGIN,
  APRON_SIZE,
  CHUNK_SAMPLE_COUNT,
  CHUNK_SAMPLES,
  ChunkCoord,
  HeightApronStore,
  TerrainDocument,
  TILE_SAMPLE_COUNT,
  TILE_SAMPLES,
  TileCoord
} from "#src/index.ts";

// CONSTANTS
const kLast = CHUNK_SAMPLES - 1;

function rampHeights(
  base: number
): Float32Array {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      heights[localZ * CHUNK_SAMPLES + localX] = base + localX + localZ * 0.01;
    }
  }

  return heights;
}

function texel(
  buffer: Float32Array,
  localX: number,
  localZ: number
): number {
  return buffer[(localZ + APRON_MARGIN) * APRON_SIZE + localX + APRON_MARGIN];
}

function setup() {
  const terrain = new TerrainDocument();
  const store = new HeightApronStore(terrain);

  return {
    terrain,
    store,
    add(x: number, z: number, base: number) {
      const coord = new ChunkCoord(x, z);
      terrain.addChunk(coord, rampHeights(base));

      return store.chunkAdded(coord);
    },
    remove(x: number, z: number) {
      const coord = new ChunkCoord(x, z);
      terrain.removeChunk(coord);

      return store.chunkRemoved(coord);
    },
    buffer(x: number, z: number) {
      return store.buffer(new ChunkCoord(x, z))!;
    }
  };
}

describe("HeightApronStore", () => {
  test("the buffer holds the chunk's own samples inside the apron", () => {
    const { add, buffer } = setup();
    add(0, 0, 100);

    assert.equal(texel(buffer(0, 0), 0, 0), 100);
    assert.equal(texel(buffer(0, 0), kLast, 7), Math.fround(100 + kLast + 0.07));
  });

  test("the apron reads the neighbours' edge samples", () => {
    const { add, buffer } = setup();
    add(0, 0, 100);
    add(1, 0, 200);
    add(0, 1, 300);
    add(1, 1, 400);

    assert.equal(texel(buffer(0, 0), CHUNK_SAMPLES, 5), Math.fround(200 + 0.05));
    assert.equal(texel(buffer(0, 0), 5, CHUNK_SAMPLES), 305);
    assert.equal(texel(buffer(0, 0), CHUNK_SAMPLES, CHUNK_SAMPLES), 400);
    assert.equal(texel(buffer(1, 0), -1, 5), Math.fround(100 + kLast + 0.05));
  });

  test("without a neighbour the apron repeats the chunk's outer samples", () => {
    const { add, buffer } = setup();
    add(0, 0, 100);

    assert.equal(texel(buffer(0, 0), -1, 5), texel(buffer(0, 0), 0, 5));
    assert.equal(texel(buffer(0, 0), CHUNK_SAMPLES, 5), texel(buffer(0, 0), kLast, 5));
    assert.equal(texel(buffer(0, 0), 5, -1), texel(buffer(0, 0), 5, 0));
    assert.equal(texel(buffer(0, 0), -1, -1), texel(buffer(0, 0), 0, 0));
  });

  test("adding a chunk rewrites only the facing strips of its neighbours", () => {
    const { add, buffer } = setup();
    add(0, 0, 100);
    add(1, 1, 400);
    const updates = add(1, 0, 200);

    assert.deepEqual(
      updates.map(({ coord, texels }) => [coord.key, texels]),
      [
        ["1,0", { x: 0, z: 0, width: APRON_SIZE, depth: APRON_SIZE }],
        ["0,0", { x: APRON_SIZE - APRON_MARGIN, z: APRON_MARGIN, width: APRON_MARGIN, depth: CHUNK_SAMPLES }],
        ["1,1", { x: APRON_MARGIN, z: 0, width: CHUNK_SAMPLES, depth: APRON_MARGIN }]
      ]
    );
    assert.equal(texel(buffer(0, 0), CHUNK_SAMPLES, 5), Math.fround(200 + 0.05));
    assert.equal(texel(buffer(1, 1), 5, -1), Math.fround(200 + 5 + kLast * 0.01));
  });

  test("a diagonal neighbour updates a single corner block", () => {
    const { add, buffer } = setup();
    add(0, 0, 100);
    const updates = add(-1, -1, 500);

    assert.deepEqual(
      updates.slice(1).map(({ coord, texels }) => [coord.key, texels]),
      [["0,0", { x: 0, z: 0, width: APRON_MARGIN, depth: APRON_MARGIN }]]
    );
    assert.equal(texel(buffer(0, 0), -1, -1), Math.fround(500 + kLast + kLast * 0.01));
  });

  test("removing a chunk lets its neighbours fall back to their own edge", () => {
    const { add, remove, store, buffer } = setup();
    add(0, 0, 100);
    add(1, 0, 200);
    remove(1, 0);

    assert.equal(store.buffer(new ChunkCoord(1, 0)), undefined);
    assert.equal(texel(buffer(0, 0), CHUNK_SAMPLES, 5), texel(buffer(0, 0), kLast, 5));
  });

  test("an edit on an edge tile rewrites the matching strip of the neighbour's apron", () => {
    const { add, terrain, store, buffer } = setup();
    add(0, 0, 100);
    add(1, 0, 200);
    add(0, 1, 300);
    const tile = new TileCoord(new ChunkCoord(0, 0), 3, 1);
    terrain.writeTile(tile, new Float32Array(TILE_SAMPLE_COUNT).fill(-5));
    const updates = store.samplesChanged(tile.chunk, {
      ...tile.localSample,
      width: TILE_SAMPLES,
      depth: TILE_SAMPLES
    });

    assert.deepEqual(
      updates.map(({ coord, texels }) => [coord.key, texels]),
      [
        ["0,0", {
          x: 3 * TILE_SAMPLES + APRON_MARGIN,
          z: TILE_SAMPLES + APRON_MARGIN,
          width: TILE_SAMPLES,
          depth: TILE_SAMPLES
        }],
        ["1,0", { x: 0, z: TILE_SAMPLES + APRON_MARGIN, width: APRON_MARGIN, depth: TILE_SAMPLES }]
      ]
    );
    assert.equal(texel(buffer(0, 0), kLast, TILE_SAMPLES), -5);
    assert.equal(texel(buffer(1, 0), -1, TILE_SAMPLES), -5);
    assert.equal(
      texel(buffer(1, 0), -1, TILE_SAMPLES - 1),
      Math.fround(100 + kLast + (TILE_SAMPLES - 1) * 0.01)
    );
  });
});
