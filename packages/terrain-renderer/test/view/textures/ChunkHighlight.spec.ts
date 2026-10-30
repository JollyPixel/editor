// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { OVERVIEW_SAMPLE_COUNT } from "#src/terrain/OverviewMap.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import {
  ChunkTextureStore,
  HIGHLIGHT_FLAG,
  lookupSlot
} from "#src/view/textures/ChunkTextureStore.ts";

function knownComponent(
  store: ChunkTextureStore,
  coord: ChunkCoord
): number {
  return (store.lookup.image.data as Float32Array)[lookupSlot(coord) * 4 + 3];
}

describe("ChunkTextureStore highlight", () => {
  test("flags the highlighted chunks in the lookup, loaded or not, across reloads, until replaced", () => {
    const terrain = new Terrain();
    const store = new ChunkTextureStore(terrain);
    const [loaded, unloaded, plain] = [0, 1, 2].map((x) => new ChunkCoord(x, 0));
    terrain.addChunk(loaded);
    terrain.addUnloadedChunk(unloaded, new Float32Array(OVERVIEW_SAMPLE_COUNT));
    terrain.addChunk(plain);
    store.chunkAdded(loaded);
    store.overviewChanged([unloaded]);
    store.chunkAdded(plain);

    store.highlight([loaded, unloaded]);
    assert.deepEqual(
      [knownComponent(store, loaded), knownComponent(store, unloaded), knownComponent(store, plain)],
      [1 + HIGHLIGHT_FLAG, 1 + HIGHLIGHT_FLAG, 1]
    );

    terrain.unloadChunk(loaded);
    store.chunkRemoved(loaded);
    assert.equal(knownComponent(store, loaded), 1 + HIGHLIGHT_FLAG);

    store.highlight([plain]);
    assert.deepEqual(
      [knownComponent(store, loaded), knownComponent(store, unloaded), knownComponent(store, plain)],
      [1, 1, 1 + HIGHLIGHT_FLAG]
    );
  });
});
