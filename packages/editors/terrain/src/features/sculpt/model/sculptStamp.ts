// Import Third-party Dependencies
import {
  ChunkCoord,
  HEIGHT_RANGE,
  TILE_SAMPLES,
  TILES_PER_CHUNK,
  TileCoord,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  falloffWeight,
  type FalloffCurve
} from "./falloff.ts";

// CONSTANTS
export const SCULPT_TOOLS = Object.freeze([
  "raise",
  "smooth",
  "flatten"
] as const);
const kSmoothKernel = [
  [1, 2, 1],
  [2, 4, 2],
  [1, 2, 1]
];

export type SculptTool = typeof SCULPT_TOOLS[number];

export interface SculptStamp {
  readonly tool: SculptTool;
  /**
   * World X and Z of the stamp's centre, in metres.
   */
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
  readonly falloff: FalloffCurve;
  /**
   * Metres a full-weight sample moves per stamp; negative lowers. Raise only.
   */
  readonly lift?: number;
  /**
   * Height flatten moves samples toward.
   */
  readonly target?: number;
}

export function sculptStamp(
  terrain: TerrainReader,
  stamp: SculptStamp
): TilePatch[] {
  const patches: TilePatch[] = [];
  for (const tile of tilesUnder(terrain, stamp)) {
    const chunk = terrain.chunk(tile.chunk)!;
    const heights = chunk.tileHeights(tile.x, tile.z);
    const corner = tileCorner(tile);
    let changed = false;
    for (let row = 0; row < TILE_SAMPLES; row++) {
      for (let column = 0; column < TILE_SAMPLES; column++) {
        const x = corner.x + column;
        const z = corner.z + row;
        const weight = stamp.strength * falloffWeight(
          stamp.falloff,
          Math.hypot(x - stamp.x, z - stamp.z) / stamp.radius
        );
        if (weight <= 0) {
          continue;
        }

        const index = row * TILE_SAMPLES + column;
        const before = heights[index];
        heights[index] = clampHeight(before + weight * stampDelta(terrain, stamp, x, z, before));
        changed ||= heights[index] !== before;
      }
    }
    if (changed) {
      patches.push({ tile, heights });
    }
  }

  return patches;
}

function stampDelta(
  terrain: TerrainReader,
  stamp: SculptStamp,
  x: number,
  z: number,
  height: number
): number {
  switch (stamp.tool) {
    case "raise":
      return stamp.lift ?? 0;
    case "flatten":
      return (stamp.target ?? height) - height;
    default:
      return smoothed(terrain, x, z) - height;
  }
}

function smoothed(
  terrain: TerrainReader,
  x: number,
  z: number
): number {
  let sum = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += kSmoothKernel[dz + 1][dx + 1] * terrain.sampleAt(x + dx, z + dz);
    }
  }

  return sum / 16;
}

function* tilesUnder(
  terrain: TerrainReader,
  { x, z, radius }: SculptStamp
): IterableIterator<TileCoord> {
  const first = TileCoord.containing(Math.ceil(x - radius), Math.ceil(z - radius));
  const last = TileCoord.containing(Math.floor(x + radius), Math.floor(z + radius));
  const firstColumn = first.chunk.x * TILES_PER_CHUNK + first.x;
  const firstRow = first.chunk.z * TILES_PER_CHUNK + first.z;
  const lastColumn = last.chunk.x * TILES_PER_CHUNK + last.x;
  const lastRow = last.chunk.z * TILES_PER_CHUNK + last.z;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const chunk = new ChunkCoord(
        Math.floor(column / TILES_PER_CHUNK),
        Math.floor(row / TILES_PER_CHUNK)
      );
      if (terrain.has(chunk)) {
        yield new TileCoord(
          chunk,
          column - chunk.x * TILES_PER_CHUNK,
          row - chunk.z * TILES_PER_CHUNK
        );
      }
    }
  }
}

function tileCorner(
  tile: TileCoord
): { x: number; z: number; } {
  const origin = tile.chunk.originSample;
  const local = tile.localSample;

  return {
    x: origin.x + local.x,
    z: origin.z + local.z
  };
}

function clampHeight(
  height: number
): number {
  return Math.min(Math.max(height, HEIGHT_RANGE.min), HEIGHT_RANGE.max);
}
