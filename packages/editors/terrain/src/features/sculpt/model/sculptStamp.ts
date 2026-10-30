// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  HEIGHT_RANGE,
  pointHeight,
  TILE_SAMPLES,
  TileCoord,
  tilesPerSide,
  type TerrainChunk,
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

interface StampFootprint {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
  readonly falloff: FalloffCurve;
}

interface RaiseStamp extends StampFootprint {
  readonly tool: "raise";
  readonly lift: number;
}

interface SmoothStamp extends StampFootprint {
  readonly tool: "smooth";
}

interface FlattenStamp extends StampFootprint {
  readonly tool: "flatten";
  readonly target: number;
}

export type SculptStamp = RaiseStamp | SmoothStamp | FlattenStamp;

interface GridSample {
  readonly x: number;
  readonly z: number;
  readonly spacing: number;
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
    const spacing = 1 / tile.tier;
    let changed = false;
    for (let row = 0; row < TILE_SAMPLES; row++) {
      for (let column = 0; column < TILE_SAMPLES; column++) {
        const x = corner.x + column * spacing;
        const z = corner.z + row * spacing;
        const weight = stamp.strength * falloffWeight(
          stamp.falloff,
          Math.hypot(x - stamp.x, z - stamp.z) / stamp.radius
        );
        if (weight <= 0) {
          continue;
        }

        const index = row * TILE_SAMPLES + column;
        const before = heights[index];
        const delta = stampDelta(terrain, stamp, { x, z, spacing }, before);
        heights[index] = clampHeight(before + weight * delta);
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
  sample: GridSample,
  height: number
): number {
  switch (stamp.tool) {
    case "raise":
      return stamp.lift;
    case "flatten":
      return stamp.target - height;
    case "smooth":
      return smoothed(terrain, sample) - height;
  }
}

function smoothed(
  terrain: TerrainReader,
  { x, z, spacing }: GridSample
): number {
  let sum = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      sum += kSmoothKernel[dz + 1][dx + 1] * pointHeight(terrain, x + dx * spacing, z + dz * spacing);
    }
  }

  return sum / 16;
}

function* tilesUnder(
  terrain: TerrainReader,
  { x, z, radius }: SculptStamp
): IterableIterator<TileCoord> {
  const first = ChunkCoord.containing(x - radius, z - radius);
  const last = ChunkCoord.containing(x + radius, z + radius);
  for (let chunkZ = first.z; chunkZ <= last.z; chunkZ++) {
    for (let chunkX = first.x; chunkX <= last.x; chunkX++) {
      const chunk = terrain.chunk(new ChunkCoord(chunkX, chunkZ));
      if (chunk !== undefined) {
        yield* chunkTilesUnder(chunk, { x, z, radius });
      }
    }
  }
}

function* chunkTilesUnder(
  chunk: TerrainChunk,
  { x, z, radius }: Pick<SculptStamp, "x" | "z" | "radius">
): IterableIterator<TileCoord> {
  const side = tilesPerSide(chunk.tier);
  const size = CHUNK_SAMPLES / side;
  const origin = chunk.coord.originSample;
  function tileRange(
    centre: number,
    start: number
  ): [number, number] {
    return [
      Math.max(0, Math.floor((centre - radius - start) / size)),
      Math.min(side - 1, Math.floor((centre + radius - start) / size))
    ];
  }
  const [firstX, lastX] = tileRange(x, origin.x);
  const [firstZ, lastZ] = tileRange(z, origin.z);
  for (let tileZ = firstZ; tileZ <= lastZ; tileZ++) {
    for (let tileX = firstX; tileX <= lastX; tileX++) {
      yield new TileCoord(chunk.coord, tileX, tileZ, chunk.tier);
    }
  }
}

function tileCorner(
  tile: TileCoord
): { x: number; z: number; } {
  const origin = tile.chunk.originSample;
  const { x, z } = tile.area;

  return {
    x: origin.x + x,
    z: origin.z + z
  };
}

function clampHeight(
  height: number
): number {
  return Math.min(Math.max(height, HEIGHT_RANGE.min), HEIGHT_RANGE.max);
}
