// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  ModelView,
  ModelViewTexture
} from "./ModelView.ts";

export interface VoxelModelSource {
  readonly document: ModelDocument;
  readonly texture: ModelViewTexture;
  attach(
    view: ModelView
  ): () => void;
}

// CONSTANTS
export const VOXEL_MODEL_SOURCE = new AssetType<VoxelModelSource>(
  "voxelmodel"
);
