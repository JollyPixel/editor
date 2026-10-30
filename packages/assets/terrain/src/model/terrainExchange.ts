// Import Third-party Dependencies
import {
  ChunkCoord,
  chunkResolution,
  fitGrid,
  SPLAT_CHANNELS,
  SPLAT_TEXELS,
  SPLAT_WEIGHT_TOTAL,
  tierOfSampleCount,
  type ChunkRect,
  type ChunkTier,
  type GrayImage,
  type HeightRange,
  type SplatTexels,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  CHUNK_COORDINATE_RANGE,
  MAX_TERRAIN_CHUNKS
} from "../network/TerrainCommand.schema.ts";
import type { ChunkContents } from "./TerrainStream.ts";

// CONSTANTS
export const MAX_EXCHANGE_IMAGE_SIDE = 16384;

export type ImportRefusal = "out-of-range" | "too-many-chunks" | "disconnected";

export interface HeightGrid {
  readonly width: number;
  readonly height: number;
  /**
   * Row-major by Z, ground outside any chunk at the lowest height.
   */
  readonly heights: Float32Array;
  readonly range: HeightRange;
}

export interface SplatMask {
  readonly slot: number;
  readonly image: GrayImage;
}

interface TexelWeight {
  readonly slot: number;
  readonly weight: number;
}

export function chunksInRect(
  { x, z, columns, rows }: ChunkRect
): ChunkCoord[] {
  return Array.from(
    { length: columns * rows },
    (_, index) => new ChunkCoord(x + index % columns, z + Math.floor(index / columns))
  );
}

export function additionOrder(
  terrain: Pick<TerrainReader, "knows" | "touches" | "overview">,
  coords: readonly ChunkCoord[]
): ChunkCoord[] | null {
  const missing = new Map(
    coords.filter((coord) => !terrain.knows(coord)).map((coord) => [coord.key, coord])
  );
  const count = missing.size;
  const order = terrain.overview.size === 0 ?
    [...missing.values()].slice(0, 1) :
    [...missing.values()].filter((coord) => terrain.touches(coord));
  for (const coord of order) {
    missing.delete(coord.key);
  }
  for (const coord of order) {
    for (const neighbour of coord.neighbours()) {
      if (missing.delete(neighbour.key)) {
        order.push(neighbour);
      }
    }
  }

  return order.length === count ? order : null;
}

export function importRefusal(
  terrain: Pick<TerrainReader, "knows" | "touches" | "overview">,
  rect: ChunkRect
): ImportRefusal | null {
  const { min, max } = CHUNK_COORDINATE_RANGE;
  const inRange = rect.x >= min && rect.z >= min &&
    rect.x + rect.columns - 1 <= max && rect.z + rect.rows - 1 <= max;
  if (!inRange) {
    return "out-of-range";
  }

  const coords = chunksInRect(rect);
  const added = coords.filter((coord) => !terrain.knows(coord)).length;
  if (terrain.overview.size + added > MAX_TERRAIN_CHUNKS) {
    return "too-many-chunks";
  }

  return additionOrder(terrain, coords) === null ? "disconnected" : null;
}

export async function readHeightGrid(
  chunks: AsyncIterable<ChunkContents>,
  rect: ChunkRect,
  tier: ChunkTier
): Promise<HeightGrid | null> {
  const resolution = chunkResolution(tier);
  const width = rect.columns * resolution;
  const height = rect.rows * resolution;
  const heights = new Float32Array(width * height).fill(Infinity);
  const range = { min: Infinity, max: -Infinity };
  for await (const chunk of chunks) {
    const source = tierOfSampleCount(chunk.heights.length)!;
    const sourceSize = { width: chunkResolution(source), height: chunkResolution(source) };
    const fitted = fitGrid(chunk.heights, sourceSize, { width: resolution, height: resolution });
    for (const value of fitted) {
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    }
    copyBlock(fitted, resolution, heights, width, blockOrigin(chunk.coord, rect, resolution));
  }
  if (range.min === Infinity) {
    return null;
  }

  return {
    width,
    height,
    heights: heights.map((value) => (value === Infinity ? range.min : value)),
    range
  };
}

export async function readSplatMasks(
  chunks: AsyncIterable<ChunkContents>,
  rect: ChunkRect
): Promise<SplatMask[]> {
  const width = rect.columns * SPLAT_TEXELS;
  const height = rect.rows * SPLAT_TEXELS;
  const masks = new Map<number, Uint16Array>();
  function maskSamples(
    slot: number
  ): Uint16Array {
    const samples = masks.get(slot) ?? new Uint16Array(width * height);
    masks.set(slot, samples);

    return samples;
  }

  for await (const { coord, splat } of chunks) {
    const origin = blockOrigin(coord, rect, SPLAT_TEXELS);
    for (let index = 0; index < splat.weights.length; index++) {
      if (splat.weights[index] > 0) {
        const texel = Math.floor(index / SPLAT_CHANNELS);
        const row = Math.floor(texel / SPLAT_TEXELS);
        const target = (origin.z + row) * width + origin.x + texel % SPLAT_TEXELS;
        maskSamples(splat.indices[index])[target] = splat.weights[index];
      }
    }
  }

  return [...masks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([slot, samples]) => {
      return { slot, image: { width, height, depth: 8, samples } };
    });
}

export function fitSplatMasks(
  masks: readonly SplatMask[],
  rect: ChunkRect
): SplatMask[] {
  const size = { width: rect.columns * SPLAT_TEXELS, height: rect.rows * SPLAT_TEXELS };

  return masks.map(({ slot, image }) => {
    const top = image.depth === 16 ? 65535 : 255;
    const fitted = fitGrid(Float32Array.from(image.samples, (sample) => sample / top * 255), image, size);

    return {
      slot,
      image: { ...size, depth: 8, samples: Uint16Array.from(fitted, Math.round) }
    };
  });
}

export function blendSplat(
  masks: readonly SplatMask[],
  rect: ChunkRect,
  { coord, splat }: ChunkContents
): SplatTexels {
  const origin = blockOrigin(coord, rect, SPLAT_TEXELS);
  const width = rect.columns * SPLAT_TEXELS;
  const indices = splat.indices.slice();
  const weights = splat.weights.slice();
  for (let row = 0; row < SPLAT_TEXELS; row++) {
    for (let column = 0; column < SPLAT_TEXELS; column++) {
      const source = (origin.z + row) * width + origin.x + column;
      const texel = masks
        .map(({ slot, image }) => {
          return { slot, weight: image.samples[source] };
        })
        .filter(({ weight }) => weight > 0);
      if (texel.length > 0) {
        writeTexel(texel, (row * SPLAT_TEXELS + column) * SPLAT_CHANNELS, indices, weights);
      }
    }
  }

  return { indices, weights };
}

export function chunkBlock(
  grid: Float32Array,
  rect: ChunkRect,
  coord: ChunkCoord,
  tier: ChunkTier
): Float32Array {
  const resolution = chunkResolution(tier);
  const width = rect.columns * resolution;
  const origin = blockOrigin(coord, rect, resolution);
  const block = new Float32Array(resolution * resolution);
  for (let row = 0; row < resolution; row++) {
    const start = (origin.z + row) * width + origin.x;
    block.set(grid.subarray(start, start + resolution), row * resolution);
  }

  return block;
}

function writeTexel(
  texel: readonly TexelWeight[],
  offset: number,
  indices: Uint8Array,
  weights: Uint8Array
): void {
  const strongest = [...texel]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, SPLAT_CHANNELS);
  const total = strongest.reduce((sum, { weight }) => sum + weight, 0);
  const scaled = strongest.map(({ weight }) => Math.floor(weight / total * SPLAT_WEIGHT_TOTAL));
  scaled[0] += SPLAT_WEIGHT_TOTAL - scaled.reduce((sum, weight) => sum + weight, 0);
  for (let channel = 0; channel < SPLAT_CHANNELS; channel++) {
    indices[offset + channel] = strongest[channel]?.slot ?? 0;
    weights[offset + channel] = scaled[channel] ?? 0;
  }
}

function blockOrigin(
  coord: ChunkCoord,
  rect: ChunkRect,
  resolution: number
): { x: number; z: number; } {
  return {
    x: (coord.x - rect.x) * resolution,
    z: (coord.z - rect.z) * resolution
  };
}

function copyBlock(
  block: Float32Array,
  resolution: number,
  target: Float32Array,
  width: number,
  origin: { readonly x: number; readonly z: number; }
): void {
  for (let row = 0; row < resolution; row++) {
    target.set(
      block.subarray(row * resolution, (row + 1) * resolution),
      (origin.z + row) * width + origin.x
    );
  }
}
