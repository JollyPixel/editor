// Import Third-party Dependencies
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import {
  VoxelModelDefinition
} from "../sceneComponents/VoxelModelDefinition.ts";
import { VOXEL_MODEL_SOURCE } from "../viewer/VoxelModelSource.ts";
import { VoxelModelLoader } from "./VoxelModelLoader.ts";

// CONSTANTS
export const VOXEL_MODEL_DEFINITION = new VoxelModelDefinition();

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [VOXEL_MODEL_DEFINITION],
  loaders: [
    {
      type: VOXEL_MODEL_SOURCE,
      create: (manager) => new VoxelModelLoader(manager)
    }
  ]
};
