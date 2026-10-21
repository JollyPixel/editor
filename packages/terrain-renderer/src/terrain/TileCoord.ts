// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";

// CONSTANTS
export const TILE_SAMPLES = 16;
export const TILES_PER_CHUNK = CHUNK_SAMPLES / TILE_SAMPLES;
export const TILE_SAMPLE_COUNT = TILE_SAMPLES * TILE_SAMPLES;

export type TileKey = `${ChunkKey}:${number}`;

export interface TilePatch {
  readonly tile: TileCoord;
  /**
   * `TILE_SAMPLE_COUNT` heights, row-major by Z.
   */
  readonly heights: Float32Array;
}

export class TileCoord {
  readonly chunk: ChunkCoord;
  readonly x: number;
  readonly z: number;

  static containing(
    sampleX: number,
    sampleZ: number
  ): TileCoord {
    const chunk = ChunkCoord.containing(sampleX, sampleZ);
    const origin = chunk.originSample;

    return new TileCoord(
      chunk,
      Math.floor((sampleX - origin.x) / TILE_SAMPLES),
      Math.floor((sampleZ - origin.z) / TILE_SAMPLES)
    );
  }

  static fromIndex(
    chunk: ChunkCoord,
    index: number
  ): TileCoord {
    return new TileCoord(chunk, index % TILES_PER_CHUNK, Math.floor(index / TILES_PER_CHUNK));
  }

  constructor(
    chunk: ChunkCoord,
    x: number,
    z: number
  ) {
    if (!isTileIndex(x) || !isTileIndex(z)) {
      throw new RangeError(
        `Tile coordinates must be integers in [0, ${TILES_PER_CHUNK - 1}], got (${x}, ${z}).`
      );
    }

    this.chunk = chunk;
    this.x = x;
    this.z = z;
  }

  get index(): number {
    return this.z * TILES_PER_CHUNK + this.x;
  }

  get key(): TileKey {
    return `${this.chunk.key}:${this.index}`;
  }

  get localSample(): { x: number; z: number; } {
    return {
      x: this.x * TILE_SAMPLES,
      z: this.z * TILE_SAMPLES
    };
  }
}

function isTileIndex(
  value: number
): boolean {
  return Number.isInteger(value) && value >= 0 && value < TILES_PER_CHUNK;
}
