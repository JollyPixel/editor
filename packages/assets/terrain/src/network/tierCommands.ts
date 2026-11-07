// Import Third-party Dependencies
import {
  resampleHeights,
  resampleHoles,
  type ChunkCoord,
  type ChunkTier,
  type TerrainChunk,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { encodeHeightBytes } from "./heights.ts";
import type { TerrainCommand } from "./types.ts";

export type TierChangedCommand = Extract<TerrainCommand, { action: "tier-changed"; }>;

export function currentTier(
  chunk: TerrainChunk
): TierChangedCommand {
  return {
    action: "tier-changed",
    x: chunk.coord.x,
    z: chunk.coord.z,
    tier: chunk.tier,
    heights: encodeHeightBytes(chunk.copyHeights()),
    ...(chunk.holes.empty ? {} : { holes: chunk.holes.copy() })
  };
}

export function resampledTier(
  terrain: TerrainReader,
  coord: ChunkCoord,
  tier: ChunkTier
): TierChangedCommand | null {
  const chunk = terrain.chunk(coord);
  if (chunk === undefined) {
    return null;
  }

  const holes = resampleHoles(chunk.holes, tier);

  return {
    action: "tier-changed",
    x: coord.x,
    z: coord.z,
    tier,
    heights: encodeHeightBytes(resampleHeights(terrain, coord, tier)),
    ...(holes.some((byte) => byte !== 0) ? { holes } : {})
  };
}
