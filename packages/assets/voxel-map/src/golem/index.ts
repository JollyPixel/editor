// Import Third-party Dependencies
import type { GolemKindList } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import type { BlocksetAsset } from "./BlocksetAsset.ts";
import type { VoxelMapAsset } from "./VoxelMapAsset.ts";
import {
  BLOCKSET_GOLEM_KIND,
  VOXEL_MAP_GOLEM_KIND
} from "./voxelMapGolemKinds.ts";

export * from "./VoxelMapAsset.ts";
export {
  BlocksetAsset,
  type BlockSummary
} from "./BlocksetAsset.ts";
export type {
  MapBlock,
  MapBlockset
} from "./MapBlocksets.ts";
export * from "./VoxelBox.ts";
export * from "./errors/UnknownBlockError.ts";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    voxelmap: VoxelMapAsset;
    blockset: BlocksetAsset;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  VOXEL_MAP_GOLEM_KIND,
  BLOCKSET_GOLEM_KIND
];
