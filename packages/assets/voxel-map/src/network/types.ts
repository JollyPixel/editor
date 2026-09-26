// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server";
import type {
  VoxelWorldCommand,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

export interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

/**
 * A map room carries layer edits, tileset links and whole-world replacements.
 * Block and material group edits go to the tileset rooms.
 */
export type VoxelNetworkCommand =
  & (
    | VoxelWorldCommand
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

export type VoxelMapRoom = network.Room<
  VoxelNetworkCommand,
  VoxelServerMessage
>;
