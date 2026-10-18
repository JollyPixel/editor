// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  APRON_MARGIN,
  APRON_SIZE,
  CHUNK_SAMPLE_COUNT,
  ChunkCoord,
  ChunkTextureStore,
  HeightApronStore,
  LOOKUP_SIZE,
  lookupSlot,
  TerrainDocument
} from "#src/index.ts";

// CONSTANTS
const kLayerTexels = APRON_SIZE * APRON_SIZE;

function setup() {
  const terrain = new TerrainDocument();
  const aprons = new HeightApronStore(terrain);
  const store = new ChunkTextureStore(aprons);

  return {
    terrain,
    aprons,
    store,
    add(x: number, z: number, height = 0) {
      const coord = new ChunkCoord(x, z);
      terrain.addChunk(coord, new Float32Array(CHUNK_SAMPLE_COUNT).fill(height));
      store.chunkAdded(coord);

      return coord;
    },
    lookupEntry(coord: ChunkCoord) {
      const data = store.lookup.image.data as Float32Array;

      return [...data.subarray(lookupSlot(coord) * 4, lookupSlot(coord) * 4 + 3)];
    },
    layerData(coord: ChunkCoord) {
      const layer = store.layer(coord)!;

      const data = store.heights.image.data as Float32Array;

      return data.subarray(layer * kLayerTexels, (layer + 1) * kLayerTexels);
    }
  };
}

describe("ChunkTextureStore", () => {
  test("a chunk's apron buffer lands in its own layer, named in the lookup", () => {
    const { add, aprons, store, lookupEntry, layerData } = setup();
    const coord = add(-3, 2, 17);

    assert.deepEqual(lookupEntry(coord), [store.layer(coord)! + 1, -3, 2]);
    assert.deepEqual(layerData(coord), aprons.buffer(coord));
    assert.ok(store.heights.layerUpdates.has(store.layer(coord)!));
  });

  test("adding a neighbour re-uploads the chunk whose apron faces it", () => {
    const { add, store, layerData } = setup();
    const origin = add(0, 0, 1);
    store.heights.clearLayerUpdates();
    add(1, 0, 9);

    assert.ok(store.heights.layerUpdates.has(store.layer(origin)!));
    assert.equal(layerData(origin)[APRON_MARGIN * APRON_SIZE + APRON_SIZE - 1], 9);
  });

  test("a chunk sharing a lookup slot with another is refused", () => {
    const { add, store } = setup();
    add(0, 0);

    assert.throws(() => add(LOOKUP_SIZE, 0), RangeError);
    assert.equal(store.size, 1);
  });

  test("removing a chunk empties its lookup slot and frees its layer", () => {
    const { add, terrain, store, lookupEntry } = setup();
    const coord = add(4, 4);
    const layer = store.layer(coord);
    terrain.removeChunk(coord);
    store.chunkRemoved(coord);

    assert.deepEqual(lookupEntry(coord), [0, 0, 0]);
    assert.equal(store.layer(add(5, 5)), layer);
  });

  test("clear empties the lookup and every layer", () => {
    const { add, store, lookupEntry } = setup();
    const coord = add(1, 1);
    store.clear();

    assert.equal(store.size, 0);
    assert.deepEqual(lookupEntry(coord), [0, 0, 0]);
  });
});
