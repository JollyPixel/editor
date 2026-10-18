// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";
import {
  CHUNK_SAMPLE_COUNT,
  TerrainChunk
} from "./TerrainChunk.ts";

export interface TerrainReader {
  readonly size: number;

  chunks(): IterableIterator<TerrainChunk>;
  chunk(coord: ChunkCoord): TerrainChunk | undefined;
  has(coord: ChunkCoord): boolean;
  touches(coord: ChunkCoord): boolean;
  sampleAt(sampleX: number, sampleZ: number): number;
  seedHeights(coord: ChunkCoord): Float32Array;
}

export class TerrainDocument implements TerrainReader {
  #chunks = new Map<ChunkKey, TerrainChunk>();

  get size(): number {
    return this.#chunks.size;
  }

  chunks(): IterableIterator<TerrainChunk> {
    return this.#chunks.values();
  }

  chunk(
    coord: ChunkCoord
  ): TerrainChunk | undefined {
    return this.#chunks.get(coord.key);
  }

  has(
    coord: ChunkCoord
  ): boolean {
    return this.#chunks.has(coord.key);
  }

  touches(
    coord: ChunkCoord
  ): boolean {
    return coord.neighbours().some((neighbour) => this.has(neighbour));
  }

  addChunk(
    coord: ChunkCoord,
    heights: Float32Array = this.seedHeights(coord)
  ): TerrainChunk {
    if (this.has(coord)) {
      throw new Error(`Chunk ${coord.key} already exists.`);
    }

    const chunk = new TerrainChunk(coord, heights);
    this.#chunks.set(coord.key, chunk);

    return chunk;
  }

  removeChunk(
    coord: ChunkCoord
  ): TerrainChunk | undefined {
    const chunk = this.#chunks.get(coord.key);
    this.#chunks.delete(coord.key);

    return chunk;
  }

  clear(): void {
    this.#chunks.clear();
  }

  sampleAt(
    sampleX: number,
    sampleZ: number
  ): number {
    const owner = this.#chunks.get(
      ChunkCoord.containing(sampleX, sampleZ).key
    ) ?? this.#nearestChunk(sampleX, sampleZ);
    if (owner === undefined) {
      return 0;
    }

    const origin = owner.coord.originSample;

    return owner.height(
      clampLocal(sampleX - origin.x),
      clampLocal(sampleZ - origin.z)
    );
  }

  seedHeights(
    coord: ChunkCoord
  ): Float32Array {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    if (this.size === 0) {
      return heights;
    }

    const origin = coord.originSample;
    for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
      for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
        heights[localZ * CHUNK_SAMPLES + localX] = this.sampleAt(
          origin.x + localX,
          origin.z + localZ
        );
      }
    }

    return heights;
  }

  #nearestChunk(
    sampleX: number,
    sampleZ: number
  ): TerrainChunk | undefined {
    let nearest: TerrainChunk | undefined;
    let nearestDistance = Infinity;
    for (const chunk of this.#chunks.values()) {
      const origin = chunk.coord.originSample;
      const dx = sampleX - (origin.x + clampLocal(sampleX - origin.x));
      const dz = sampleZ - (origin.z + clampLocal(sampleZ - origin.z));
      const distance = dx * dx + dz * dz;
      if (distance < nearestDistance) {
        nearest = chunk;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}

function clampLocal(
  local: number
): number {
  return Math.min(Math.max(local, 0), CHUNK_SAMPLES - 1);
}
