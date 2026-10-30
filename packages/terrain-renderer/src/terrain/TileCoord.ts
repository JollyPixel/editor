// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";
import type { ChunkTier } from "./chunkTier.ts";

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

export interface TileArea {
  readonly x: number;
  readonly z: number;
  readonly size: number;
}

export function tilesPerSide(
  tier: ChunkTier
): number {
  return TILES_PER_CHUNK * tier;
}

export function tileCount(
  tier: ChunkTier
): number {
  return tilesPerSide(tier) ** 2;
}

export class TileCoord {
  readonly chunk: ChunkCoord;
  readonly x: number;
  readonly z: number;
  readonly tier: ChunkTier;

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
    index: number,
    tier: ChunkTier = 1
  ): TileCoord {
    const side = tilesPerSide(tier);

    return new TileCoord(chunk, index % side, Math.floor(index / side), tier);
  }

  static all(
    chunk: ChunkCoord,
    tier: ChunkTier = 1
  ): TileCoord[] {
    return Array.from({ length: tileCount(tier) }, (_, index) => TileCoord.fromIndex(chunk, index, tier));
  }

  constructor(
    chunk: ChunkCoord,
    x: number,
    z: number,
    tier: ChunkTier = 1
  ) {
    const side = tilesPerSide(tier);
    if (!isTileIndex(x, side) || !isTileIndex(z, side)) {
      throw new RangeError(
        `Tile coordinates at x${tier} must be integers in [0, ${side - 1}], got (${x}, ${z}).`
      );
    }

    this.chunk = chunk;
    this.x = x;
    this.z = z;
    this.tier = tier;
  }

  get index(): number {
    return this.z * tilesPerSide(this.tier) + this.x;
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

  get area(): TileArea {
    const size = TILE_SAMPLES / this.tier;

    return { x: this.x * size, z: this.z * size, size };
  }
}

function isTileIndex(
  value: number,
  side: number
): boolean {
  return Number.isInteger(value) && value >= 0 && value < side;
}
