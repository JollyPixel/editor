// Import Third-party Dependencies
import type { GolemKindList } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import type { VoxelModelAsset } from "./VoxelModelAsset.ts";
import { VOXEL_MODEL_GOLEM_KIND } from "./voxelModelGolemKind.ts";

export * from "./VoxelModelAsset.ts";
export type {
  AddBlocksInput,
  AddMaterialsInput,
  BlockSpec,
  MaterialSpec
} from "./ModelSpecs.ts";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    voxelmodel: VoxelModelAsset;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  VOXEL_MODEL_GOLEM_KIND
];
