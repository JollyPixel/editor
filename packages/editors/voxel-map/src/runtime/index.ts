// Import Third-party Dependencies
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";
import { VoxelMapDefinition } from "@jolly-pixel/voxel.renderer/engine";

// CONSTANTS
export const VOXEL_MAP_DEFINITION = new VoxelMapDefinition();

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [VOXEL_MAP_DEFINITION]
};
