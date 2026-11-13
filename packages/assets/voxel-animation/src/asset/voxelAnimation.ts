// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { AnimationSetSnapshot } from "../network/types.ts";
import { VOXEL_ANIMATION_ICON } from "./icons.ts";

// CONSTANTS
export const VOXEL_ANIMATION_KIND = "voxelanimation";
export const VOXEL_ANIMATION_COMMAND = "voxelanimation.command";
export const VOXEL_ANIMATION_EXTENSION = ".voxelanim.json";
export const VOXEL_ANIMATION_FILE_VERSION = 1;

export const VOXEL_ANIMATION_ASSET: AssetKindDescriptor = {
  kind: VOXEL_ANIMATION_KIND,
  label: "Animation set",
  extension: VOXEL_ANIMATION_EXTENSION,
  icon: VOXEL_ANIMATION_ICON
};

export type VoxelAnimationFile = AnimationSetSnapshot & {
  version: typeof VOXEL_ANIMATION_FILE_VERSION;
};
