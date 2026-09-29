// Import Third-party Dependencies
import type { VoxelTilesetUsage } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { formatCount } from "../../shared/format.ts";

export function tilesetIsUnused(
  usage: VoxelTilesetUsage
): boolean {
  return usage.blocks.length === 0 && usage.voxels === 0;
}

export function tilesetUsageSummary(
  usage: VoxelTilesetUsage
): string {
  return `Used by ${formatCount(usage.blocks.length, "block")}, ` +
    `${formatCount(usage.voxels, "voxel")} in the map.`;
}

export function tilesetRemovalMessage(
  usage: VoxelTilesetUsage
): string {
  const count = usage.blocks.length;
  if (count === 0) {
    return "No block uses this tileset.";
  }

  const placed = usage.voxels === 0 ?
    "none placed in the map" :
    `${formatCount(usage.voxels, "voxel")} in the map`;
  const verb = count === 1 ?
    "comes from this tileset and leaves the map with it" :
    "come from this tileset and leave the map with it";

  return `${formatCount(count, "block")} (${placed}) ${verb}.`;
}
