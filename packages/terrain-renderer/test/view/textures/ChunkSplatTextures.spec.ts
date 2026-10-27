// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import {
  SPLAT_CHANNELS,
  SPLAT_TEXEL_COUNT,
  SPLAT_TILE_TEXEL_COUNT,
  uniformSplat
} from "#src/terrain/SplatMap.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { TileCoord } from "#src/terrain/TileCoord.ts";
import {
  ChunkTextureStore,
  OVERVIEW_TEXTURE_SIZE
} from "#src/view/textures/ChunkTextureStore.ts";

function splatLayer(
  store: ChunkTextureStore,
  coord: ChunkCoord
): { indices: Uint8Array; weights: Uint8Array; } {
  const size = SPLAT_TEXEL_COUNT * SPLAT_CHANNELS;
  const offset = store.layer(coord)! * size;

  return {
    indices: (store.splatIndices.image.data as Uint8Array).subarray(offset, offset + size),
    weights: (store.splatWeights.image.data as Uint8Array).subarray(offset, offset + size)
  };
}

function overviewSlot(
  store: ChunkTextureStore,
  gridX: number,
  gridZ: number
): number {
  return (store.overviewMaterials.image.data as Uint8Array)[gridZ * OVERVIEW_TEXTURE_SIZE + gridX];
}

describe("ChunkTextureStore splat", () => {
  test("a chunk's splat fills its own layer, and a painted tile re-uploads it", () => {
    const terrain = new Terrain();
    const store = new ChunkTextureStore(terrain);
    const coord = new ChunkCoord(0, 0);
    terrain.addChunk(coord, undefined, uniformSplat(SPLAT_TEXEL_COUNT, 2));
    store.chunkAdded(coord);
    assert.equal(splatLayer(store, coord).indices[0], 2);

    store.splatIndices.clearLayerUpdates();
    const tile = TileCoord.fromIndex(coord, 0);
    terrain.writeSplatTile(tile, uniformSplat(SPLAT_TILE_TEXEL_COUNT, 7));
    store.splatChanged([tile]);

    const { indices, weights } = splatLayer(store, coord);
    assert.deepEqual([indices[0], weights[0], indices[40 * SPLAT_CHANNELS]], [7, 255, 2]);
    assert.deepEqual([...store.splatIndices.layerUpdates], [store.layer(coord)]);
    assert.equal(overviewSlot(store, 0, 0), 7);
  });

  test("an unloaded chunk shows its overview materials, and leaving clears them", () => {
    const terrain = new Terrain();
    const store = new ChunkTextureStore(terrain);
    const coord = new ChunkCoord(1, 0);
    terrain.addUnloadedChunk(coord, new Float32Array(4), new Uint8Array([3, 4, 5, 6]));
    store.overviewChanged([coord]);

    const points = [[2, 0], [3, 0], [2, 1], [3, 1]];
    assert.deepEqual(points.map(([x, z]) => overviewSlot(store, x, z)), [3, 4, 5, 6]);

    terrain.removeChunk(coord);
    store.overviewChanged([coord]);
    assert.equal(overviewSlot(store, 2, 0), 0);
  });
});
