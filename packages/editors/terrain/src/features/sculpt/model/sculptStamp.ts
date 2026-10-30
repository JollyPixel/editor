// Import Third-party Dependencies
import {
  pointHeight,
  TILE_SAMPLES,
  type TerrainReader,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  falloffWeight,
  type FalloffCurve
} from "./falloff.ts";
import {
  clampHeight,
  squareAround,
  tileCorner,
  tilesInRect
} from "./tileGrid.ts";

// CONSTANTS
export const SCULPT_TOOLS = Object.freeze([
  "raise",
  "smooth",
  "flatten",
  "terrace"
] as const);
const kMaxTerraceFlat = 0.98;
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

interface TerraceStamp extends StampFootprint {
  readonly tool: "terrace";
  readonly step: number;
  readonly sharpness: number;
}

export type SculptStamp = RaiseStamp | SmoothStamp | FlattenStamp | TerraceStamp;

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
  for (const tile of tilesInRect(terrain, squareAround(stamp))) {
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
    case "terrace":
      return terraceHeight(height, stamp.step, stamp.sharpness) - height;
  }
}

export function terraceHeight(
  height: number,
  step: number,
  sharpness: number
): number {
  const base = Math.floor(height / step) * step;
  const within = (height - base) / step;
  const flat = Math.min(Math.max(sharpness, 0), kMaxTerraceFlat);
  const rise = Math.min(Math.max((within - flat / 2) / (1 - flat), 0), 1);

  return base + step * rise * rise * (3 - 2 * rise);
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
