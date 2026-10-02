// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
  PixelWireCommand,
  PixelWireSnapshot
} from "@jolly-pixel/asset.pixel-art/client";
import type {
  TilesetDocumentCommand,
  TilesetDocumentJSON
} from "@jolly-pixel/voxel.renderer";

export type TilesetDocumentNetworkCommand =
  & TilesetDocumentCommand
  & network.NetworkCommandHeader;

export type TilesetNetworkCommand =
  | PixelWireCommand
  | TilesetDocumentNetworkCommand;

export interface TilesetSnapshot extends TilesetDocumentJSON {
  pixels: PixelWireSnapshot;
}

export type TilesetServerMessage = network.NetworkServerMessage<
  TilesetNetworkCommand,
  TilesetSnapshot,
  AssetRoomNotice
>;

export type TilesetRoom = network.Room<
  TilesetNetworkCommand,
  TilesetServerMessage
>;
