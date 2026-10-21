// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  type ChunkCoord
} from "./ChunkCoord.ts";
import {
  TILE_SAMPLE_COUNT,
  TILE_SAMPLES
} from "./TileCoord.ts";

// CONSTANTS
export const HEIGHT_RANGE = {
  min: -4096,
  max: 4096
} as const;
export const CHUNK_SAMPLE_COUNT = CHUNK_SAMPLES * CHUNK_SAMPLES;

export function isValidHeight(
  height: number
): boolean {
  return Number.isFinite(height) &&
    height >= HEIGHT_RANGE.min &&
    height <= HEIGHT_RANGE.max;
}

export function isValidHeights(
  heights: Float32Array
): boolean {
  return heights.length === CHUNK_SAMPLE_COUNT &&
    heights.every(isValidHeight);
}

export interface HeightRange {
  readonly min: number;
  readonly max: number;
}

export class TerrainChunk {
  readonly coord: ChunkCoord;

  #origin: { readonly x: number; readonly z: number; };
  #heights: Float32Array;
  #heightRange: HeightRange;

  constructor(
    coord: ChunkCoord,
    heights: Float32Array = new Float32Array(CHUNK_SAMPLE_COUNT)
  ) {
    if (!isValidHeights(heights)) {
      throw new RangeError(
        `Chunk ${coord.key} needs ${CHUNK_SAMPLE_COUNT} finite heights within ` +
        `[${HEIGHT_RANGE.min}, ${HEIGHT_RANGE.max}].`
      );
    }

    this.coord = coord;
    this.#origin = coord.originSample;
    this.#heights = heights.slice();
    this.#heightRange = measureRange(this.#heights);
  }

  get heightRange(): HeightRange {
    return this.#heightRange;
  }

  height(
    localX: number,
    localZ: number
  ): number {
    return this.#heights[localZ * CHUNK_SAMPLES + localX];
  }

  nearestHeight(
    sampleX: number,
    sampleZ: number
  ): number {
    const origin = this.#origin;

    return this.height(
      clampLocal(sampleX - origin.x),
      clampLocal(sampleZ - origin.z)
    );
  }

  squaredDistanceTo(
    sampleX: number,
    sampleZ: number
  ): number {
    const origin = this.#origin;
    const dx = sampleX - origin.x - clampLocal(sampleX - origin.x);
    const dz = sampleZ - origin.z - clampLocal(sampleZ - origin.z);

    return dx * dx + dz * dz;
  }

  copyHeights(): Float32Array {
    return this.#heights.slice();
  }

  tileHeights(
    tileX: number,
    tileZ: number
  ): Float32Array {
    const heights = new Float32Array(TILE_SAMPLE_COUNT);
    for (let row = 0; row < TILE_SAMPLES; row++) {
      const start = (tileZ * TILE_SAMPLES + row) * CHUNK_SAMPLES + tileX * TILE_SAMPLES;
      heights.set(this.#heights.subarray(start, start + TILE_SAMPLES), row * TILE_SAMPLES);
    }

    return heights;
  }

  writeTile(
    tileX: number,
    tileZ: number,
    heights: Float32Array
  ): void {
    if (heights.length !== TILE_SAMPLE_COUNT || !heights.every(isValidHeight)) {
      throw new RangeError(
        `Tile ${tileX},${tileZ} of chunk ${this.coord.key} needs ${TILE_SAMPLE_COUNT} finite heights ` +
        `within [${HEIGHT_RANGE.min}, ${HEIGHT_RANGE.max}].`
      );
    }

    for (let row = 0; row < TILE_SAMPLES; row++) {
      this.#heights.set(
        heights.subarray(row * TILE_SAMPLES, (row + 1) * TILE_SAMPLES),
        (tileZ * TILE_SAMPLES + row) * CHUNK_SAMPLES + tileX * TILE_SAMPLES
      );
    }
    this.#heightRange = measureRange(this.#heights);
  }
}

function measureRange(
  heights: Float32Array
): HeightRange {
  let min = Infinity;
  let max = -Infinity;
  for (const height of heights) {
    min = Math.min(min, height);
    max = Math.max(max, height);
  }

  return { min, max };
}

function clampLocal(
  local: number
): number {
  return Math.min(Math.max(local, 0), CHUNK_SAMPLES - 1);
}
