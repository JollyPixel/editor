// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";
import { SampleBlock } from "./SampleBlock.ts";
import {
  CHUNK_SAMPLE_COUNT,
  TerrainChunk
} from "./TerrainChunk.ts";
import type { TileCoord } from "./TileCoord.ts";

export interface TerrainReader {
  readonly size: number;

  chunks(): IterableIterator<TerrainChunk>;
  chunk(coord: ChunkCoord): TerrainChunk | undefined;
  has(coord: ChunkCoord): boolean;
  touches(coord: ChunkCoord): boolean;
  sampleAt(sampleX: number, sampleZ: number): number;
  sampleBlock(coord: ChunkCoord): SampleBlock;
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

  writeTile(
    tile: TileCoord,
    heights: Float32Array
  ): Float32Array {
    const chunk = this.#chunks.get(tile.chunk.key);
    if (chunk === undefined) {
      throw new Error(`Chunk ${tile.chunk.key} does not exist.`);
    }

    const previous = chunk.tileHeights(tile.x, tile.z);
    chunk.writeTile(tile.x, tile.z, heights);

    return previous;
  }

  sampleAt(
    sampleX: number,
    sampleZ: number
  ): number {
    return this.sampleBlock(ChunkCoord.containing(sampleX, sampleZ))
      .height(sampleX, sampleZ);
  }

  sampleBlock(
    coord: ChunkCoord
  ): SampleBlock {
    return new SampleBlock(this, coord);
  }

  seedHeights(
    coord: ChunkCoord
  ): Float32Array {
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    if (this.size === 0) {
      return heights;
    }

    const block = this.sampleBlock(coord);
    const source = block.heightRange === null ? this.#nearestSamples() : block;
    const origin = coord.originSample;
    for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
      for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
        heights[localZ * CHUNK_SAMPLES + localX] =
          source.height(origin.x + localX, origin.z + localZ);
      }
    }

    return heights;
  }

  #nearestSamples(): Pick<SampleBlock, "height"> {
    return {
      height: (sampleX, sampleZ) => this.#nearestChunk(sampleX, sampleZ)
        ?.nearestHeight(sampleX, sampleZ) ?? 0
    };
  }

  #nearestChunk(
    sampleX: number,
    sampleZ: number
  ): TerrainChunk | undefined {
    let nearest: TerrainChunk | undefined;
    let nearestDistance = Infinity;
    for (const chunk of this.#chunks.values()) {
      const distance = chunk.squaredDistanceTo(sampleX, sampleZ);
      if (distance < nearestDistance) {
        nearest = chunk;
        nearestDistance = distance;
      }
    }

    return nearest;
  }
}
