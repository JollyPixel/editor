// Import Third-party Dependencies
import type { VoxelMapNetworkCommand } from "@jolly-pixel/asset.voxel-map/client";
import {
  CapabilityTable,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type MapAction = VoxelMapNetworkCommand["action"];

export type MapCapability =
  | "voxels"
  | "layers"
  | "objects"
  | "templates"
  | "blocksets";

export type MapAccess = Grants<MapCapability>;
export type MapGrants = RoomGrants<MapAction, MapCapability>;
export type MapAccessSource = Pick<MapGrants, "current">;

export const MAP_CAPABILITIES = new CapabilityTable<MapAction, MapCapability>({
  "voxel-set": "voxels",
  "voxel-removed": "voxels",
  "voxels-set": "voxels",
  "voxels-removed": "voxels",
  "voxels-patched": "voxels",
  added: "layers",
  removed: "layers",
  updated: "layers",
  cloned: "layers",
  merged: "layers",
  "position-updated": "layers",
  "position-rebased": "layers",
  "layer-transformed": "layers",
  "layer-moved": "layers",
  "object-layer-added": "layers",
  "object-layer-removed": "layers",
  "object-layer-updated": "layers",
  "world-replace": "layers",
  "object-added": "objects",
  "object-removed": "objects",
  "object-moved": "objects",
  "object-updated": "objects",
  "template-defined": "templates",
  "template-updated": "templates",
  "template-removed": "templates",
  "blockset-added": "blocksets",
  "blockset-removed": "blocksets"
});
