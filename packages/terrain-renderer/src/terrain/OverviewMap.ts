// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";
import type {
  HeightRange,
  TerrainChunk
} from "./TerrainChunk.ts";
import {
  TILE_SAMPLES,
  type TileCoord
} from "./TileCoord.ts";

// CONSTANTS
export const OVERVIEW_SPACING = 32;
export const OVERVIEW_SAMPLES = CHUNK_SAMPLES / OVERVIEW_SPACING;
export const OVERVIEW_SAMPLE_COUNT = OVERVIEW_SAMPLES * OVERVIEW_SAMPLES;

export interface OverviewReader {
  readonly size: number;

  has(coord: ChunkCoord): boolean;
  coords(): IterableIterator<ChunkCoord>;
  samples(coord: ChunkCoord): Float32Array | undefined;
  heightRange(coord: ChunkCoord): HeightRange | undefined;
  heightAt(sampleX: number, sampleZ: number): number | undefined;
  interpolate(sampleX: number, sampleZ: number): number | undefined;
}

interface OverviewEntry {
  readonly coord: ChunkCoord;
  readonly samples: Float32Array;
  range: HeightRange;
}

export class OverviewMap implements OverviewReader {
  #entries = new Map<ChunkKey, OverviewEntry>();

  get size(): number {
    return this.#entries.size;
  }

  has(
    coord: ChunkCoord
  ): boolean {
    return this.#entries.has(coord.key);
  }

  * coords(): IterableIterator<ChunkCoord> {
    for (const { coord } of this.#entries.values()) {
      yield coord;
    }
  }

  samples(
    coord: ChunkCoord
  ): Float32Array | undefined {
    return this.#entries.get(coord.key)?.samples.slice();
  }

  heightRange(
    coord: ChunkCoord
  ): HeightRange | undefined {
    return this.#entries.get(coord.key)?.range;
  }

  heightAt(
    sampleX: number,
    sampleZ: number
  ): number | undefined {
    if (sampleX % OVERVIEW_SPACING !== 0 || sampleZ % OVERVIEW_SPACING !== 0) {
      return undefined;
    }

    return this.#gridHeight(sampleX / OVERVIEW_SPACING, sampleZ / OVERVIEW_SPACING);
  }

  interpolate(
    sampleX: number,
    sampleZ: number
  ): number | undefined {
    const gridX = Math.floor(sampleX / OVERVIEW_SPACING);
    const gridZ = Math.floor(sampleZ / OVERVIEW_SPACING);
    const base = this.#gridHeight(gridX, gridZ);
    if (base === undefined) {
      return undefined;
    }

    const east = this.#gridHeight(gridX + 1, gridZ) ?? base;
    const north = this.#gridHeight(gridX, gridZ + 1) ?? base;
    const corner = this.#gridHeight(gridX + 1, gridZ + 1) ?? base;
    const blendX = sampleX / OVERVIEW_SPACING - gridX;
    const blendZ = sampleZ / OVERVIEW_SPACING - gridZ;
    const near = base + (east - base) * blendX;
    const far = north + (corner - north) * blendX;

    return near + (far - near) * blendZ;
  }

  set(
    coord: ChunkCoord,
    samples: Float32Array
  ): void {
    if (samples.length !== OVERVIEW_SAMPLE_COUNT) {
      throw new RangeError(
        `Chunk ${coord.key} needs ${OVERVIEW_SAMPLE_COUNT} overview samples, got ${samples.length}.`
      );
    }

    const copy = samples.slice();
    this.#entries.set(coord.key, { coord, samples: copy, range: sampleRange(copy) });
  }

  writeTile(
    tile: TileCoord,
    heights: Float32Array
  ): boolean {
    const entry = this.#entries.get(tile.chunk.key);
    if (entry === undefined) {
      return false;
    }

    const { x: tileX, z: tileZ } = tile.localSample;
    let changed = false;
    for (let row = 0; row < OVERVIEW_SAMPLES; row++) {
      for (let column = 0; column < OVERVIEW_SAMPLES; column++) {
        const localX = column * OVERVIEW_SPACING - tileX;
        const localZ = row * OVERVIEW_SPACING - tileZ;
        if (localX >= 0 && localX < TILE_SAMPLES && localZ >= 0 && localZ < TILE_SAMPLES) {
          entry.samples[row * OVERVIEW_SAMPLES + column] = heights[localZ * TILE_SAMPLES + localX];
          changed = true;
        }
      }
    }
    if (changed) {
      entry.range = sampleRange(entry.samples);
    }

    return changed;
  }

  delete(
    coord: ChunkCoord
  ): void {
    this.#entries.delete(coord.key);
  }

  clear(): void {
    this.#entries.clear();
  }

  #gridHeight(
    gridX: number,
    gridZ: number
  ): number | undefined {
    const coord = new ChunkCoord(
      Math.floor(gridX / OVERVIEW_SAMPLES),
      Math.floor(gridZ / OVERVIEW_SAMPLES)
    );
    const index = (gridZ - coord.z * OVERVIEW_SAMPLES) * OVERVIEW_SAMPLES +
      gridX - coord.x * OVERVIEW_SAMPLES;

    return this.#entries.get(coord.key)?.samples[index];
  }
}

function sampleRange(
  samples: Float32Array
): HeightRange {
  let min = Infinity;
  let max = -Infinity;
  for (const height of samples) {
    min = Math.min(min, height);
    max = Math.max(max, height);
  }

  return { min, max };
}

export function overviewSamples(
  chunk: Pick<TerrainChunk, "height">
): Float32Array {
  const samples = new Float32Array(OVERVIEW_SAMPLE_COUNT);
  for (let row = 0; row < OVERVIEW_SAMPLES; row++) {
    for (let column = 0; column < OVERVIEW_SAMPLES; column++) {
      samples[row * OVERVIEW_SAMPLES + column] = chunk.height(
        column * OVERVIEW_SPACING,
        row * OVERVIEW_SPACING
      );
    }
  }

  return samples;
}

export function isOverviewTile(
  tile: TileCoord
): boolean {
  const { x, z } = tile.localSample;

  return x % OVERVIEW_SPACING === 0 && z % OVERVIEW_SPACING === 0;
}
