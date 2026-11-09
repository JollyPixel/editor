// Import Third-party Dependencies
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";
import {
  VOXEL_MAP_ASSET,
  VoxelMapDefinition
} from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import { BlocksetLoader } from "./BlocksetLoader.ts";
import { GAME_BLOCKSET } from "./GameBlockset.ts";
import { VoxelMapLoader } from "./VoxelMapLoader.ts";

// CONSTANTS
export const VOXEL_MAP_DEFINITION = new VoxelMapDefinition();

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [VOXEL_MAP_DEFINITION],
  loaders: [
    {
      type: VOXEL_MAP_ASSET,
      create: (manager) => new VoxelMapLoader(manager)
    },
    {
      type: GAME_BLOCKSET,
      create: (manager) => new BlocksetLoader(manager)
    }
  ]
};
