// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server/kinds";
import type {
  VoxelCommand,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

export interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

export type VoxelNetworkCommand =
  & (
    | VoxelCommand
    | VoxelWorldReplaceCommand
  )
  & network.NetworkCommandHeader;

export type VoxelAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

export type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON,
  VoxelAssetNotice
>;
