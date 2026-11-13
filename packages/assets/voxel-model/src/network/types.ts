// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../model/types.ts";

export type VoxelModelNetworkCommand = VoxelModelCommand & network.NetworkCommandHeader;

export type VoxelModelServerMessage = network.NetworkServerMessage<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  AssetRoomNotice
>;

export type VoxelModelRoom = network.Room<
  VoxelModelNetworkCommand,
  VoxelModelServerMessage
>;
