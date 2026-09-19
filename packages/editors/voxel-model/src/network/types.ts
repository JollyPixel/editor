// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  VoxelModelNetworkCommand,
  VoxelModelServerMessage
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

export type VoxelModelRoom = network.Room<
  VoxelModelNetworkCommand,
  VoxelModelServerMessage
>;
