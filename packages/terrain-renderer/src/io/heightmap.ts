// Import Internal Dependencies
import { isChunkTier, type ChunkTier } from "../terrain/chunkTier.ts";
import {
  isValidHeight,
  type HeightRange
} from "../terrain/TerrainChunk.ts";
import type { GrayImage } from "./png.ts";

// CONSTANTS
const kMaxSample = 65535;

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

export interface ChunkRect {
  readonly x: number;
  readonly z: number;
  readonly columns: number;
  readonly rows: number;
}

export interface HeightmapSidecar extends GridSize, HeightRange {
  readonly tier: ChunkTier;
  readonly rect: ChunkRect;
}

export function measureHeights(
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

export function quantizeHeights(
  heights: Float32Array,
  { min, max }: HeightRange
): Uint16Array {
  const span = max - min;

  return Uint16Array.from(heights, (height) => (span === 0 ?
    0 :
    Math.round((height - min) / span * kMaxSample)));
}

export function expandHeights(
  { samples, depth }: GrayImage,
  { min, max }: HeightRange
): Float32Array {
  const top = depth === 16 ? kMaxSample : 255;

  return Float32Array.from(samples, (sample) => min + sample / top * (max - min));
}

export function fitGrid(
  source: Float32Array,
  from: GridSize,
  to: GridSize
): Float32Array {
  const stepX = ownedSamples(from.width) / to.width;
  const stepZ = ownedSamples(from.height) / to.height;
  const fitted = new Float32Array(to.width * to.height);
  for (let row = 0; row < to.height; row++) {
    const z = row * stepZ;
    const z0 = Math.floor(z);
    const z1 = Math.min(z0 + 1, from.height - 1);
    for (let column = 0; column < to.width; column++) {
      const x = column * stepX;
      const x0 = Math.floor(x);
      const x1 = Math.min(x0 + 1, from.width - 1);
      const near = lerp(source[z0 * from.width + x0], source[z0 * from.width + x1], x - x0);
      const far = lerp(source[z1 * from.width + x0], source[z1 * from.width + x1], x - x0);
      fitted[row * to.width + column] = lerp(near, far, z - z0);
    }
  }

  return fitted;
}

export function parseHeightmapSidecar(
  text: string
): HeightmapSidecar | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  }
  catch {
    return null;
  }

  return isHeightmapSidecar(value) ? value : null;
}

function isHeightmapSidecar(
  value: unknown
): value is HeightmapSidecar {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { min, max, width, height, tier, rect } = value as Partial<Record<keyof HeightmapSidecar, unknown>>;

  return isValidHeight(min as number) && isValidHeight(max as number) &&
    (min as number) <= (max as number) &&
    [width, height].every((side) => Number.isInteger(side) && (side as number) > 0) &&
    isChunkTier(tier) &&
    isChunkRect(rect);
}

function isChunkRect(
  value: unknown
): value is ChunkRect {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { x, z, columns, rows } = value as Partial<Record<keyof ChunkRect, unknown>>;

  return [x, z].every(Number.isInteger) &&
    [columns, rows].every((side) => Number.isInteger(side) && (side as number) > 0);
}

function ownedSamples(
  side: number
): number {
  return side % 2 === 1 && side > 1 ? side - 1 : side;
}

function lerp(
  from: number,
  to: number,
  amount: number
): number {
  return from + (to - from) * amount;
}
