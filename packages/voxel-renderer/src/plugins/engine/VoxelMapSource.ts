// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { VoxelDocument } from "../../document/VoxelDocument.ts";
import type { VoxelView } from "../../view/VoxelView.ts";

export interface VoxelMapSource {
  readonly document: VoxelDocument;
  attach(
    view: VoxelView
  ): () => void;
}

// CONSTANTS
export const VOXEL_MAP_ASSET = new AssetType<VoxelMapSource>(
  "voxelmap"
);
