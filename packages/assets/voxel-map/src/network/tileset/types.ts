// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server/kinds";
import {
  isPixelCommandAction,
  type PixelBufferSnapshot,
  type PixelNetworkCommand
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type {
  TilesetDocumentCommand,
  TilesetDocumentJSON
} from "@jolly-pixel/voxel.renderer";

export type TilesetDocumentNetworkCommand =
  & TilesetDocumentCommand
  & network.NetworkCommandHeader;

/**
 * A tileset room carries the pixel commands of its texture and the block,
 * material group and tile size commands of its document.
 */
export type TilesetNetworkCommand =
  | PixelNetworkCommand
  | TilesetDocumentNetworkCommand;

export interface TilesetSnapshot extends TilesetDocumentJSON {
  pixels: PixelBufferSnapshot;
}

export type TilesetAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

export type TilesetServerMessage = network.NetworkServerMessage<
  TilesetNetworkCommand,
  TilesetSnapshot,
  TilesetAssetNotice
>;

export type TilesetRoom = network.Room<
  TilesetNetworkCommand,
  TilesetServerMessage
>;

export function isPixelNetworkCommand(
  command: TilesetNetworkCommand
): command is PixelNetworkCommand {
  return isPixelCommandAction(command.action);
}
