// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { ModelDocument } from "../model/index.ts";
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
