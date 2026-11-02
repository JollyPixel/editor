// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
  VoxelWorldCommand,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

export interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

export type VoxelMapNetworkCommand =
  & (
    | VoxelWorldCommand
    | VoxelWorldReplaceCommand
  )
  & network.NetworkCommandHeader;

export type VoxelMapServerMessage = network.NetworkServerMessage<
  VoxelMapNetworkCommand,
  VoxelWorldJSON,
  AssetRoomNotice
>;

export type VoxelMapRoom = network.Room<
  VoxelMapNetworkCommand,
  VoxelMapServerMessage
>;
