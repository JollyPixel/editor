// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/document/ChunkCoord.ts";
import { CHUNK_SAMPLE_COUNT } from "#src/document/TerrainChunk.ts";
import type { TerrainDocument } from "#src/document/TerrainDocument.ts";
import {
  TILE_SAMPLE_COUNT,
  TileCoord
} from "#src/document/TileCoord.ts";
import { ChunkTextureStore } from "#src/view/textures/ChunkTextureStore.ts";
import {
  APRON_MARGIN,
  APRON_SIZE,
  APRON_TEXELS
} from "#src/view/textures/heightApron.ts";
import {
  randomInteger,
  type Random
} from "./random.ts";

export function rebuildStore(
  terrain: TerrainDocument
): ChunkTextureStore {
  const store = new ChunkTextureStore(terrain);
  for (const chunk of terrain.chunks()) {
    store.chunkAdded(chunk.coord);
  }

  return store;
}

export function apronSamples(
  store: ChunkTextureStore,
  coord: ChunkCoord
): Float32Array {
  const data = store.heights.image.data as Float32Array;
  const layer = store.layer(coord)!;

  return data.slice(layer * APRON_TEXELS, (layer + 1) * APRON_TEXELS);
}

export function sampledApron(
  terrain: TerrainDocument,
  coord: ChunkCoord
): Float32Array {
  const origin = coord.originSample;
  const apron = new Float32Array(APRON_TEXELS);
  for (let localZ = -APRON_MARGIN; localZ < CHUNK_SAMPLES + APRON_MARGIN; localZ++) {
    for (let localX = -APRON_MARGIN; localX < CHUNK_SAMPLES + APRON_MARGIN; localX++) {
      apron[(localZ + APRON_MARGIN) * APRON_SIZE + localX + APRON_MARGIN] =
        terrain.sampleAt(origin.x + localX, origin.z + localZ);
    }
  }

  return apron;
}

export function applyRandomEdit(
  random: Random,
  terrain: TerrainDocument,
  store: ChunkTextureStore
): string {
  const chunks = [...terrain.chunks()];
  const action = randomInteger(random, 0, 3);
  if (action === 0 && chunks.length > 1) {
    const { coord } = chunks[randomInteger(random, 0, chunks.length - 1)];
    terrain.removeChunk(coord);
    store.chunkRemoved(coord);

    return `remove ${coord.key}`;
  }
  if (action === 1) {
    const tiles = Array.from({ length: randomInteger(random, 1, 4) }, () => {
      const { coord } = chunks[randomInteger(random, 0, chunks.length - 1)];
      const tile = new TileCoord(coord, randomInteger(random, 0, 3), randomInteger(random, 0, 3));
      const heights = new Float32Array(TILE_SAMPLE_COUNT).map(() => randomInteger(random, -50, 50));
      terrain.writeTile(tile, heights);

      return tile;
    });
    store.tilesChanged(tiles);

    return `edit ${tiles.map((tile) => tile.key).join(" ")}`;
  }

  const coord = new ChunkCoord(randomInteger(random, -1, 2), randomInteger(random, -1, 2));
  if (terrain.has(coord)) {
    return "none";
  }
  terrain.addChunk(coord, action === 2 ? randomHeights(random) : undefined);
  store.chunkAdded(coord);

  return `add ${coord.key}`;
}

function randomHeights(
  random: Random
): Float32Array {
  return new Float32Array(CHUNK_SAMPLE_COUNT).map(() => randomInteger(random, -400, 400) / 8);
}
