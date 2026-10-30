// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { resampleHeights } from "#src/terrain/chunkResample.ts";
import { CHUNK_SAMPLE_COUNT } from "#src/terrain/TerrainChunk.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { TileCoord } from "#src/terrain/TileCoord.ts";
import {
  ChunkTextureStore,
  lookupSlot
} from "#src/view/textures/ChunkTextureStore.ts";
import {
  APRON_MARGIN,
  apronSize
} from "#src/view/textures/heightApron.ts";

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

describe("ChunkTextureStore tiers", () => {
  test("a refined chunk moves to its tier's array, grown on demand, and coarsening frees its layer", () => {
    const terrain = new Terrain();
    const replaced: number[] = [];
    const store = new ChunkTextureStore(terrain, { replaced: (tier) => replaced.push(tier) });
    const [coarse, fine, other] = [0, 1, 2].map((x) => {
      const coord = new ChunkCoord(x, 0);
      terrain.addChunk(coord, rampHeights(x * 100));
      store.chunkAdded(coord);

      return coord;
    });
    function retier(
      coord: ChunkCoord,
      tier: 1 | 2
    ): void {
      terrain.changeTier(coord, resampleHeights(terrain, coord, tier));
      store.tilesChanged(TileCoord.all(coord));
    }
    function fineTexel(
      gridX: number,
      gridZ: number
    ): number {
      const size = apronSize(2);
      const data = store.refinedArrays(2).heights.image.data as Float32Array;
      const layer = store.tierLayer(fine)!.layer;

      return data[layer * size * size + (gridZ + APRON_MARGIN) * size + gridX + APRON_MARGIN];
    }
    const placeholder = store.refinedArrays(2).heights;

    retier(fine, 2);
    const slot = lookupSlot(fine) * 4;
    assert.deepEqual(replaced, [2]);
    assert.notEqual(store.refinedArrays(2).heights, placeholder);
    assert.deepEqual(store.tierLayer(fine), { tier: 2, layer: 0 });
    assert.deepEqual([...(store.lookup.image.data as Float32Array).subarray(slot, slot + 4)], [
      store.layer(fine)! + 1, 1, 0, 2
    ]);
    assert.deepEqual([fineTexel(1, 0), fineTexel(-1, 0)], [100.5, (kLast + 100) / 2]);
    assert.equal(store.tierLayer(coarse)!.tier, 1);

    retier(fine, 1);
    retier(other, 2);
    assert.deepEqual(store.tierLayer(fine), { tier: 1, layer: store.layer(fine) });
    assert.deepEqual(store.tierLayer(other), { tier: 2, layer: 0 });
    assert.deepEqual(replaced, [2]);
  });
});
