// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { CHUNK_SAMPLE_COUNT } from "#src/terrain/TerrainChunk.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { surfaceHeight } from "#src/terrain/terrainSurface.ts";
import {
  TILE_SAMPLE_COUNT,
  TILE_SAMPLES,
  TileCoord
} from "#src/terrain/TileCoord.ts";
import {
  ChunkTextureStore,
  LOOKUP_SIZE,
  lookupSlot
} from "#src/view/textures/ChunkTextureStore.ts";
import {
  APRON_MARGIN,
  APRON_SIZE
} from "#src/view/textures/heightApron.ts";
import {
  apronSamples,
  applyRandomEdit,
  knownFlags,
  rebuildStore,
  sampledApron
} from "../../helpers/apron.ts";
import { seededRandom } from "../../helpers/random.ts";

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

function apronTexel(
  store: ChunkTextureStore,
  coord: ChunkCoord,
  localX: number,
  localZ: number
): number {
  return apronSamples(store, coord)[(localZ + APRON_MARGIN) * APRON_SIZE + localX + APRON_MARGIN];
}

function setup() {
  const terrain = new Terrain();
  const store = new ChunkTextureStore(terrain);

  return {
    terrain,
    store,
    add(x: number, z: number, base = 0) {
      const coord = new ChunkCoord(x, z);
      terrain.addChunk(coord, rampHeights(base));
      store.chunkAdded(coord);

      return coord;
    },
    remove(x: number, z: number) {
      const coord = new ChunkCoord(x, z);
      terrain.removeChunk(coord);
      store.chunkRemoved(coord);
    },
    lookupEntry(coord: ChunkCoord) {
      const data = store.lookup.image.data as Float32Array;

      return [...data.subarray(lookupSlot(coord) * 4, lookupSlot(coord) * 4 + 3)];
    },
    texel(x: number, z: number, localX: number, localZ: number) {
      return apronTexel(store, new ChunkCoord(x, z), localX, localZ);
    },
    updatedLayers(...coords: ChunkCoord[]) {
      return {
        actual: [...store.heights.layerUpdates].sort(),
        expected: coords.map((coord) => store.layer(coord)!).sort()
      };
    }
  };
}

describe("ChunkTextureStore", () => {
  test("a chunk's samples land inside the apron of its own layer, named in the lookup", () => {
    const { add, store, lookupEntry, texel } = setup();
    const coord = add(-3, 2, 100);

    assert.deepEqual(lookupEntry(coord), [store.layer(coord)! + 1, -3, 2]);
    assert.ok(store.heights.layerUpdates.has(store.layer(coord)!));
    assert.equal(texel(-3, 2, 0, 0), 100);
    assert.equal(texel(-3, 2, kLast, 7), Math.fround(100 + kLast + 0.07));
  });

  test("the apron reads the neighbours' edge samples", () => {
    const { add, texel } = setup();
    add(0, 0, 100);
    add(1, 0, 200);
    add(0, 1, 300);
    add(1, 1, 400);

    assert.equal(texel(0, 0, CHUNK_SAMPLES, 5), Math.fround(200 + 0.05));
    assert.equal(texel(0, 0, 5, CHUNK_SAMPLES), 305);
    assert.equal(texel(0, 0, CHUNK_SAMPLES, CHUNK_SAMPLES), 400);
    assert.equal(texel(1, 0, -1, 5), Math.fround(100 + kLast + 0.05));
  });

  test("without a neighbour the apron repeats the chunk's outer samples", () => {
    const { add, texel } = setup();
    add(0, 0, 100);

    assert.equal(texel(0, 0, -1, 5), texel(0, 0, 0, 5));
    assert.equal(texel(0, 0, CHUNK_SAMPLES, 5), texel(0, 0, kLast, 5));
    assert.equal(texel(0, 0, 5, -1), texel(0, 0, 5, 0));
    assert.equal(texel(0, 0, -1, -1), texel(0, 0, 0, 0));
  });

  test("adding a chunk re-uploads the neighbours whose apron faces it", () => {
    const { add, store, texel, updatedLayers } = setup();
    const origin = add(0, 0, 100);
    const diagonal = add(1, 1, 400);
    add(-5, -5);
    store.heights.clearLayerUpdates();
    const added = add(1, 0, 200);

    const { actual, expected } = updatedLayers(added, origin, diagonal);
    assert.deepEqual(actual, expected);
    assert.equal(texel(0, 0, CHUNK_SAMPLES, 5), Math.fround(200 + 0.05));
    assert.equal(texel(1, 1, 5, -1), Math.fround(200 + 5 + kLast * 0.01));
  });

  test("a diagonal neighbour fills the facing corner of the apron", () => {
    const { add, texel } = setup();
    add(0, 0, 100);
    add(-1, -1, 500);

    assert.equal(texel(0, 0, -1, -1), Math.fround(500 + kLast + kLast * 0.01));
  });

  test("removing a chunk frees its slot and layer, and its neighbours fall back to their own edge", () => {
    const { add, remove, store, lookupEntry, texel } = setup();
    add(0, 0, 100);
    const removed = add(1, 0, 200);
    const layer = store.layer(removed);
    remove(1, 0);

    assert.deepEqual(lookupEntry(removed), [0, 0, 0]);
    assert.equal(texel(0, 0, CHUNK_SAMPLES, 5), texel(0, 0, kLast, 5));
    assert.equal(store.layer(add(5, 5)), layer);
  });

  test("removing a chunk refreshes the margin a diagonal neighbour borrowed through a missing chunk", () => {
    const { add, remove, texel } = setup();
    add(2, 0, 100);
    add(1, 1, 300);
    const borrowed = texel(2, 0, -2, kLast);
    remove(1, 1);

    assert.equal(borrowed, 300 + kLast - 1);
    assert.equal(texel(2, 0, -2, kLast), texel(2, 0, 0, kLast));
  });

  test("a chunk sharing a lookup slot with another is refused", () => {
    const { add, store } = setup();
    add(0, 0);

    assert.throws(() => add(LOOKUP_SIZE, 0), RangeError);
    assert.equal(store.size, 1);
  });

  test("a chunk added twice is refused as already in the view", () => {
    const { add, store } = setup();
    const coord = add(1, 2);

    assert.throws(() => store.chunkAdded(coord), /Chunk 1,2 is already in the view/);
    assert.equal(store.size, 1);
  });

  test("a chunk still in the terrain cannot leave the view", () => {
    const { add, store, lookupEntry } = setup();
    const coord = add(1, 2);

    assert.throws(() => store.chunkRemoved(coord), /Chunk 1,2 must leave the terrain/);
    assert.deepEqual(lookupEntry(coord), [store.layer(coord)! + 1, 1, 2]);
  });

  test("a chunk missing from the terrain is refused without claiming a layer or slot", () => {
    const { store, lookupEntry } = setup();
    const coord = new ChunkCoord(2, 2);

    assert.throws(() => store.chunkAdded(coord));
    assert.equal(store.size, 0);
    assert.deepEqual(lookupEntry(coord), [0, 0, 0]);
  });

  test("clear empties the lookup and every layer", () => {
    const { add, store, lookupEntry } = setup();
    const coord = add(1, 1);
    store.clear();

    assert.equal(store.size, 0);
    assert.deepEqual(lookupEntry(coord), [0, 0, 0]);
  });

  test("an edited edge tile re-uploads its own layer and the neighbour whose apron it reaches", () => {
    const { add, terrain, store, texel, updatedLayers } = setup();
    const edited = add(0, 0, 100);
    const facing = add(1, 0, 200);
    add(0, 1, 300);
    add(-1, 0, 400);
    store.heights.clearLayerUpdates();
    const tile = new TileCoord(edited, 3, 1);
    terrain.writeTile(tile, new Float32Array(TILE_SAMPLE_COUNT).fill(-5));
    store.tilesChanged([tile]);

    const { actual, expected } = updatedLayers(edited, facing);
    assert.deepEqual(actual, expected);
    assert.equal(texel(0, 0, kLast, TILE_SAMPLES), -5);
    assert.equal(texel(1, 0, -1, TILE_SAMPLES), -5);
    assert.equal(
      texel(1, 0, -1, TILE_SAMPLES - 1),
      Math.fround(100 + kLast + (TILE_SAMPLES - 1) * 0.01)
    );
  });

  test("tiles edited together on both sides of a chunk reach its own apron and both neighbours", () => {
    const { add, terrain, store, texel } = setup();
    const edited = add(0, 0, 100);
    add(1, 0, 200);
    add(-1, 0, 400);
    const tiles = [new TileCoord(edited, 3, 1), new TileCoord(edited, 0, 2)];
    for (const tile of tiles) {
      terrain.writeTile(tile, new Float32Array(TILE_SAMPLE_COUNT).fill(-5));
    }
    store.tilesChanged(tiles);

    assert.equal(texel(1, 0, -1, TILE_SAMPLES), -5);
    assert.equal(texel(-1, 0, CHUNK_SAMPLES, 2 * TILE_SAMPLES), -5);
    assert.equal(texel(0, 0, kLast, TILE_SAMPLES), -5);
    assert.equal(texel(0, 0, 0, 2 * TILE_SAMPLES), -5);
  });

  test("editing an edge tile with no neighbour refreshes the margin", () => {
    const { add, terrain, store, texel } = setup();
    const edited = add(0, 0, 100);
    const tile = new TileCoord(edited, 3, 1);
    terrain.writeTile(tile, new Float32Array(TILE_SAMPLE_COUNT).fill(-5));
    store.tilesChanged([tile]);

    assert.equal(texel(0, 0, kLast, TILE_SAMPLES), -5);
    assert.equal(texel(0, 0, CHUNK_SAMPLES, TILE_SAMPLES), -5);
    assert.equal(texel(0, 0, CHUNK_SAMPLES + 1, TILE_SAMPLES), -5);
  });

  test("after any edit, load or unload every apron texel is the height picked at its sample", () => {
    const random = seededRandom(99);
    for (let sequence = 0; sequence < 6; sequence++) {
      const terrain = new Terrain();
      terrain.addChunk(new ChunkCoord(0, 0), rampHeights(10));
      const store = rebuildStore(terrain);
      const steps: string[] = [];
      for (let step = 0; step < 8; step++) {
        steps.push(applyRandomEdit(random, terrain, store));
        const rebuilt = rebuildStore(terrain);
        for (const { coord } of terrain.chunks()) {
          const message = `${coord.key} after ${steps.join(", ")}`;
          assert.deepEqual(apronSamples(store, coord), apronSamples(rebuilt, coord), message);
          assert.deepEqual(apronSamples(store, coord), sampledApron(terrain, coord), message);
        }
        assert.deepEqual(store.overview.image.data, rebuilt.overview.image.data, steps.join(", "));
        assert.deepEqual(knownFlags(store), knownFlags(rebuilt), steps.join(", "));
        rebuilt.dispose();
      }
    }
  });

  test("an open corner's picked height matches the apron texel the shader reads", () => {
    const terrain = new Terrain();
    const store = new ChunkTextureStore(terrain);
    const low = terrain.addChunk(new ChunkCoord(0, 0), new Float32Array(CHUNK_SAMPLE_COUNT).fill(1));
    const high = terrain.addChunk(new ChunkCoord(0, 1), new Float32Array(CHUNK_SAMPLE_COUNT).fill(9));
    store.chunkAdded(low.coord);
    store.chunkAdded(high.coord);
    const shaderCorner = apronTexel(store, high.coord, CHUNK_SAMPLES, 0);

    assert.equal(shaderCorner, 1);
    assert.equal(apronTexel(store, low.coord, CHUNK_SAMPLES, CHUNK_SAMPLES), shaderCorner);
    assert.equal(surfaceHeight(terrain, kLast + 0.5, kLast + 0.5), (1 + shaderCorner) / 2);
  });
});
