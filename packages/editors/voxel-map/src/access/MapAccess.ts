// Import Third-party Dependencies
import {
  VOXEL_MAP_CAPABILITIES,
  type VoxelMapNetworkCommand
} from "@jolly-pixel/asset.voxel-map/client";
import {
  CapabilityTable,
  type CapabilityName,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type MapAction = VoxelMapNetworkCommand["action"];
export type MapCapability = CapabilityName<typeof VOXEL_MAP_CAPABILITIES>;

export type MapAccess = Grants<MapCapability>;
export type MapGrants = RoomGrants<MapAction, MapCapability>;
export type MapAccessSource = Pick<MapGrants, "current">;

export const MAP_CAPABILITY_TABLE = new CapabilityTable(VOXEL_MAP_CAPABILITIES);
