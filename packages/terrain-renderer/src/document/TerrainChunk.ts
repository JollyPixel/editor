// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  type ChunkCoord
} from "./ChunkCoord.ts";

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
  readonly heightRange: HeightRange;

  #heights: Float32Array;

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
    this.#heights = heights.slice();
    this.heightRange = {
      min: this.#heights.reduce((min, height) => Math.min(min, height)),
      max: this.#heights.reduce((max, height) => Math.max(max, height))
    };
  }

  height(
    localX: number,
    localZ: number
  ): number {
    return this.#heights[localZ * CHUNK_SAMPLES + localX];
  }

  copyHeights(): Float32Array {
    return this.#heights.slice();
  }
}
