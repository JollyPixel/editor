// Import Third-party Dependencies
import {
  VOXEL_MODEL_CAPABILITIES,
  type VoxelModelCommandAction
} from "@jolly-pixel/asset.voxel-model/client";
import {
  CapabilityTable,
  type CapabilityName,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type ModelCapability = CapabilityName<typeof VOXEL_MODEL_CAPABILITIES>;

export type ModelAccess = Grants<ModelCapability>;
export type ModelGrants = RoomGrants<VoxelModelCommandAction, ModelCapability>;
export type ModelAccessSource = Pick<ModelGrants, "current">;
export type ModelAccessSignals = Pick<ModelGrants, "current" | "subscribe">;

export const MODEL_CAPABILITY_TABLE = new CapabilityTable(
  VOXEL_MODEL_CAPABILITIES
);
