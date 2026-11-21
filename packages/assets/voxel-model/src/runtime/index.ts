// Import Third-party Dependencies
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { VoxelModelDefinition } from "./VoxelModelDefinition.ts";
import { VOXEL_MODEL_SOURCE } from "./VoxelModelSource.ts";
import { VoxelModelLoader } from "./VoxelModelLoader.ts";

export * from "./ModelView.ts";
export * from "./VoxelModelDefinition.ts";
export * from "./VoxelModelSource.ts";
export * from "./pixelModelTexture.ts";
export * from "./blocks/BlockBody.ts";
export * from "./blocks/BlockNode.ts";
export * from "./blocks/BlockShapeMesh.ts";
export * from "./blocks/paintBlockSurface.ts";

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
