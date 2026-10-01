// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VOXEL_MAP_ICON } from "./icons.ts";

// CONSTANTS
export const VOXEL_MAP_KIND = "voxelmap";
export const VOXEL_MAP_COMMAND = "voxelmap.command";
export const VOXEL_MAP_EXTENSION = ".voxelmap.json";

export const VOXEL_MAP_ASSET: AssetKindDescriptor = {
  kind: VOXEL_MAP_KIND,
  label: "Voxel map",
  extension: VOXEL_MAP_EXTENSION,
  icon: VOXEL_MAP_ICON
};
