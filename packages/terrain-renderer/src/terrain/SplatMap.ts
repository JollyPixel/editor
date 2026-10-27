// Import Internal Dependencies
import {
  OVERVIEW_SAMPLE_COUNT,
  OVERVIEW_SAMPLES
} from "./OverviewMap.ts";
import { TILES_PER_CHUNK } from "./TileCoord.ts";

// CONSTANTS
export const SPLAT_TEXELS = 128;
export const SPLAT_TEXEL_COUNT = SPLAT_TEXELS * SPLAT_TEXELS;
export const SPLAT_CHANNELS = 4;
export const SPLAT_WEIGHT_TOTAL = 255;
export const SPLAT_TILE_TEXELS = SPLAT_TEXELS / TILES_PER_CHUNK;
export const SPLAT_TILE_TEXEL_COUNT = SPLAT_TILE_TEXELS * SPLAT_TILE_TEXELS;
const kOverviewTexelSpacing = SPLAT_TEXELS / OVERVIEW_SAMPLES;

export interface SplatTexels {
  /**
   * Four material slots per texel, row-major by Z.
   */
  readonly indices: Uint8Array;
  /**
   * The weight of each slot, summing to `SPLAT_WEIGHT_TOTAL` per texel.
   */
  readonly weights: Uint8Array;
}

export function isValidSplat(
  { indices, weights }: SplatTexels,
  texels: number
): boolean {
  if (indices.length !== texels * SPLAT_CHANNELS || weights.length !== texels * SPLAT_CHANNELS) {
    return false;
  }

  for (let texel = 0; texel < texels; texel++) {
    let total = 0;
    for (let channel = 0; channel < SPLAT_CHANNELS; channel++) {
      total += weights[texel * SPLAT_CHANNELS + channel];
    }
    if (total !== SPLAT_WEIGHT_TOTAL) {
      return false;
    }
  }

  return true;
}

export function uniformSplat(
  texels: number,
  slot = 0
): SplatTexels {
  const indices = new Uint8Array(texels * SPLAT_CHANNELS);
  const weights = new Uint8Array(texels * SPLAT_CHANNELS);
  for (let texel = 0; texel < texels; texel++) {
    indices[texel * SPLAT_CHANNELS] = slot;
    weights[texel * SPLAT_CHANNELS] = SPLAT_WEIGHT_TOTAL;
  }

  return { indices, weights };
}

export function dominantSlot(
  { indices, weights }: SplatTexels,
  texel: number
): number {
  let best = 0;
  for (let channel = 1; channel < SPLAT_CHANNELS; channel++) {
    if (weights[texel * SPLAT_CHANNELS + channel] > weights[texel * SPLAT_CHANNELS + best]) {
      best = channel;
    }
  }

  return indices[texel * SPLAT_CHANNELS + best];
}

export class SplatMap {
  #indices: Uint8Array;
  #weights: Uint8Array;

  constructor(
    texels: SplatTexels = uniformSplat(SPLAT_TEXEL_COUNT)
  ) {
    if (!isValidSplat(texels, SPLAT_TEXEL_COUNT)) {
      throw new RangeError(
        `A splat map needs ${SPLAT_TEXEL_COUNT} texels of ${SPLAT_CHANNELS} slots ` +
        `whose weights sum to ${SPLAT_WEIGHT_TOTAL}.`
      );
    }

    this.#indices = texels.indices.slice();
    this.#weights = texels.weights.slice();
  }

  load(
    texels: SplatTexels
  ): void {
    if (!isValidSplat(texels, SPLAT_TEXEL_COUNT)) {
      throw new RangeError(
        `A splat map needs ${SPLAT_TEXEL_COUNT} texels whose weights sum to ${SPLAT_WEIGHT_TOTAL}.`
      );
    }

    this.#indices.set(texels.indices);
    this.#weights.set(texels.weights);
  }

  copy(): SplatTexels {
    return {
      indices: this.#indices.slice(),
      weights: this.#weights.slice()
    };
  }

  tile(
    tileX: number,
    tileZ: number
  ): SplatTexels {
    const indices = new Uint8Array(SPLAT_TILE_TEXEL_COUNT * SPLAT_CHANNELS);
    const weights = new Uint8Array(SPLAT_TILE_TEXEL_COUNT * SPLAT_CHANNELS);
    const rowLength = SPLAT_TILE_TEXELS * SPLAT_CHANNELS;
    for (let row = 0; row < SPLAT_TILE_TEXELS; row++) {
      const start = texelIndex(tileX * SPLAT_TILE_TEXELS, tileZ * SPLAT_TILE_TEXELS + row) * SPLAT_CHANNELS;
      indices.set(this.#indices.subarray(start, start + rowLength), row * rowLength);
      weights.set(this.#weights.subarray(start, start + rowLength), row * rowLength);
    }

    return { indices, weights };
  }

  writeTile(
    tileX: number,
    tileZ: number,
    texels: SplatTexels
  ): void {
    if (!isValidSplat(texels, SPLAT_TILE_TEXEL_COUNT)) {
      throw new RangeError(
        `Splat tile ${tileX},${tileZ} needs ${SPLAT_TILE_TEXEL_COUNT} texels whose weights ` +
        `sum to ${SPLAT_WEIGHT_TOTAL}.`
      );
    }

    const rowLength = SPLAT_TILE_TEXELS * SPLAT_CHANNELS;
    for (let row = 0; row < SPLAT_TILE_TEXELS; row++) {
      const start = texelIndex(tileX * SPLAT_TILE_TEXELS, tileZ * SPLAT_TILE_TEXELS + row) * SPLAT_CHANNELS;
      this.#indices.set(texels.indices.subarray(row * rowLength, (row + 1) * rowLength), start);
      this.#weights.set(texels.weights.subarray(row * rowLength, (row + 1) * rowLength), start);
    }
  }

  dominantSlot(
    texelX: number,
    texelZ: number
  ): number {
    return dominantSlot(
      { indices: this.#indices, weights: this.#weights },
      texelIndex(texelX, texelZ)
    );
  }

  overviewMaterials(): Uint8Array {
    const materials = new Uint8Array(OVERVIEW_SAMPLE_COUNT);
    for (let row = 0; row < OVERVIEW_SAMPLES; row++) {
      for (let column = 0; column < OVERVIEW_SAMPLES; column++) {
        materials[row * OVERVIEW_SAMPLES + column] = this.dominantSlot(
          column * kOverviewTexelSpacing,
          row * kOverviewTexelSpacing
        );
      }
    }

    return materials;
  }
}

function texelIndex(
  texelX: number,
  texelZ: number
): number {
  return texelZ * SPLAT_TEXELS + texelX;
}
