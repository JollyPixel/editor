// Import Internal Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./ChunkCoord.ts";
import type { TerrainChunk } from "./TerrainChunk.ts";

// CONSTANTS
export const OVERVIEW_SPACING = 32;
export const OVERVIEW_SAMPLES = CHUNK_SAMPLES / OVERVIEW_SPACING;
export const OVERVIEW_SAMPLE_COUNT = OVERVIEW_SAMPLES * OVERVIEW_SAMPLES;

export interface OverviewReader {
  readonly size: number;

  samples(coord: ChunkCoord): Float32Array | undefined;
  heightAt(sampleX: number, sampleZ: number): number | undefined;
}

export class OverviewMap implements OverviewReader {
  #samples = new Map<ChunkKey, Float32Array>();

  get size(): number {
    return this.#samples.size;
  }

  samples(
    coord: ChunkCoord
  ): Float32Array | undefined {
    return this.#samples.get(coord.key)?.slice();
  }

  heightAt(
    sampleX: number,
    sampleZ: number
  ): number | undefined {
    if (sampleX % OVERVIEW_SPACING !== 0 || sampleZ % OVERVIEW_SPACING !== 0) {
      return undefined;
    }

    const coord = ChunkCoord.containing(sampleX, sampleZ);
    const origin = coord.originSample;
    const index = ((sampleZ - origin.z) / OVERVIEW_SPACING) * OVERVIEW_SAMPLES +
      (sampleX - origin.x) / OVERVIEW_SPACING;

    return this.#samples.get(coord.key)?.[index];
  }

  derive(
    chunk: TerrainChunk
  ): void {
    this.#samples.set(chunk.coord.key, overviewSamples(chunk));
  }

  delete(
    coord: ChunkCoord
  ): void {
    this.#samples.delete(coord.key);
  }

  clear(): void {
    this.#samples.clear();
  }
}

export function overviewSamples(
  chunk: TerrainChunk
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
