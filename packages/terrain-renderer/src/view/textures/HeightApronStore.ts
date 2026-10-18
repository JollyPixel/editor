// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "../../document/ChunkCoord.ts";
import type { TerrainReader } from "../../document/TerrainDocument.ts";

// CONSTANTS
export const APRON_SIZE = CHUNK_SAMPLES + 2;

export interface SampleRect {
  /**
   * Local sample X and Z of the rectangle's corner; the apron spans -1 to
   * `CHUNK_SAMPLES`.
   */
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

export interface ApronUpdate {
  readonly coord: ChunkCoord;
  /**
   * Texels rewritten in the chunk's `APRON_SIZE` buffer, row-major by Z.
   */
  readonly texels: SampleRect;
}

const kChunkRect: SampleRect = {
  x: 0,
  z: 0,
  width: CHUNK_SAMPLES,
  depth: CHUNK_SAMPLES
};
const kApronRect: SampleRect = {
  x: -1,
  z: -1,
  width: APRON_SIZE,
  depth: APRON_SIZE
};

export class HeightApronStore {
  #terrain: TerrainReader;
  #buffers = new Map<ChunkKey, Float32Array>();

  constructor(
    terrain: TerrainReader
  ) {
    this.#terrain = terrain;
  }

  buffer(
    coord: ChunkCoord
  ): Float32Array | undefined {
    return this.#buffers.get(coord.key);
  }

  chunkAdded(
    coord: ChunkCoord
  ): ApronUpdate[] {
    this.#buffers.set(coord.key, new Float32Array(APRON_SIZE * APRON_SIZE));

    return [
      this.#rewrite(coord, kApronRect),
      ...this.#rewriteNeighbours(coord, kChunkRect)
    ];
  }

  chunkRemoved(
    coord: ChunkCoord
  ): ApronUpdate[] {
    this.#buffers.delete(coord.key);

    return this.#rewriteNeighbours(coord, kChunkRect);
  }

  #rewriteNeighbours(
    coord: ChunkCoord,
    rect: SampleRect
  ): ApronUpdate[] {
    const updates: ApronUpdate[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbour = new ChunkCoord(coord.x + dx, coord.z + dz);
        if ((dx === 0 && dz === 0) || !this.#buffers.has(neighbour.key)) {
          continue;
        }

        const texels = intersect(
          {
            ...rect,
            x: rect.x - dx * CHUNK_SAMPLES,
            z: rect.z - dz * CHUNK_SAMPLES
          },
          kApronRect
        );
        if (texels !== null) {
          updates.push(this.#rewrite(neighbour, texels));
        }
      }
    }

    return updates;
  }

  #rewrite(
    coord: ChunkCoord,
    texels: SampleRect
  ): ApronUpdate {
    const buffer = this.#buffers.get(coord.key)!;
    const own = this.#terrain.chunk(coord)!;
    const origin = coord.originSample;
    for (let localZ = texels.z; localZ < texels.z + texels.depth; localZ++) {
      for (let localX = texels.x; localX < texels.x + texels.width; localX++) {
        const owner = ChunkCoord.containing(origin.x + localX, origin.z + localZ);
        const chunk = this.#terrain.chunk(owner);
        buffer[(localZ + 1) * APRON_SIZE + localX + 1] = chunk === undefined ?
          own.height(clampLocal(localX), clampLocal(localZ)) :
          chunk.height(
            origin.x + localX - owner.originSample.x,
            origin.z + localZ - owner.originSample.z
          );
      }
    }

    return {
      coord,
      texels: {
        ...texels,
        x: texels.x + 1,
        z: texels.z + 1
      }
    };
  }
}

function intersect(
  left: SampleRect,
  right: SampleRect
): SampleRect | null {
  const x = Math.max(left.x, right.x);
  const z = Math.max(left.z, right.z);
  const width = Math.min(left.x + left.width, right.x + right.width) - x;
  const depth = Math.min(left.z + left.depth, right.z + right.depth) - z;

  return width > 0 && depth > 0 ? { x, z, width, depth } : null;
}

function clampLocal(
  local: number
): number {
  return Math.min(Math.max(local, 0), CHUNK_SAMPLES - 1);
}
