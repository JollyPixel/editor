// Import Third-party Dependencies
import {
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
  tileCorner,
  tilesInRect
} from "./tileGrid.ts";

export interface RampEnd {
  readonly x: number;
  readonly z: number;
  readonly height: number;
}

export interface RampStamp {
  readonly from: RampEnd;
  readonly to: RampEnd;
  readonly radius: number;
  readonly strength: number;
  readonly falloff: FalloffCurve;
}

export function rampStamp(
  terrain: TerrainReader,
  { from, to, radius, strength, falloff }: RampStamp
): TilePatch[] {
  const patches: TilePatch[] = [];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const rect = {
    minX: Math.min(from.x, to.x) - radius,
    minZ: Math.min(from.z, to.z) - radius,
    maxX: Math.max(from.x, to.x) + radius,
    maxZ: Math.max(from.z, to.z) + radius
  };
  for (const tile of tilesInRect(terrain, rect)) {
    const heights = terrain.chunk(tile.chunk)!.tileHeights(tile.x, tile.z);
    const corner = tileCorner(tile);
    const spacing = 1 / tile.tier;
    let changed = false;
    for (let row = 0; row < TILE_SAMPLES; row++) {
      for (let column = 0; column < TILE_SAMPLES; column++) {
        const x = corner.x + column * spacing;
        const z = corner.z + row * spacing;
        const along = lengthSquared === 0 ?
          0 :
          Math.min(Math.max(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared, 0), 1);
        const distance = Math.hypot(x - from.x - dx * along, z - from.z - dz * along);
        const weight = strength * falloffWeight(falloff, distance / radius);
        if (weight <= 0) {
          continue;
        }

        const index = row * TILE_SAMPLES + column;
        const before = heights[index];
        const target = from.height + (to.height - from.height) * along;
        heights[index] = clampHeight(before + weight * (target - before));
        changed ||= heights[index] !== before;
      }
    }
    if (changed) {
      patches.push({ tile, heights });
    }
  }

  return patches;
}
