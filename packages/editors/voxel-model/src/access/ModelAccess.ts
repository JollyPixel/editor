// Import Third-party Dependencies
import type { VoxelModelCommandAction } from "@jolly-pixel/asset.voxel-model/client";
import {
  CapabilityTable,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type ModelCapability =
  | "hierarchy"
  | "transforms"
  | "uv"
  | "materials"
  | "animations";

export type ModelAccess = Grants<ModelCapability>;
export type ModelGrants = RoomGrants<VoxelModelCommandAction, ModelCapability>;
export type ModelAccessSource = Pick<ModelGrants, "current">;
export type ModelAccessSignals = Pick<ModelGrants, "current" | "subscribe">;

export const MODEL_CAPABILITIES = new CapabilityTable<
  VoxelModelCommandAction,
  ModelCapability
>({
  "node-added": "hierarchy",
  "node-removed": "hierarchy",
  "node-moved": "hierarchy",
  "node-renamed": "hierarchy",
  "node-transformed": "transforms",
  "node-uv-changed": "uv",
  "material-added": "materials",
  "material-changed": "materials",
  "material-folder-added": "materials",
  "material-moved": "materials",
  "material-removed": "materials",
  "material-renamed": "materials",
  "node-material-changed": "materials",
  "animation-set-linked": "animations",
  "animation-set-owned": "animations",
  "animation-set-unlinked": "animations",
  "animation-binding-changed": "animations",
  "animation-binding-cleared": "animations"
});
