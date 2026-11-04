// Import Third-party Dependencies
import { JsonAssetFile } from "@jolly-pixel/asset-server";
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import {
  compactVoxelModelFile,
  compactVoxelModelFileSchema,
  expandVoxelModelFile,
  VOXEL_MODEL_KIND
} from "./voxelModel.ts";

// CONSTANTS
export const VOXEL_MODEL_FILE = new JsonAssetFile({
  kind: VOXEL_MODEL_KIND,
  schema: compactVoxelModelFileSchema,
  expand: expandVoxelModelFile,
  compact: compactVoxelModelFile,
  isInvalid: (error) => error instanceof InvalidEntryError
});
