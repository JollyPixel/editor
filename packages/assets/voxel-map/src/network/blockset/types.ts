// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
  PixelWireCommand,
  PixelWireSnapshot
} from "@jolly-pixel/asset.pixel-art/client";
import type {
  BlocksetDocumentCommand,
  BlocksetDocumentJSON
} from "@jolly-pixel/voxel.renderer";

export type BlocksetDocumentNetworkCommand =
  & BlocksetDocumentCommand
  & network.NetworkCommandHeader;

export type BlocksetNetworkCommand =
  | PixelWireCommand
  | BlocksetDocumentNetworkCommand;

export interface BlocksetSnapshot extends BlocksetDocumentJSON {
  pixels: PixelWireSnapshot;
}

export type BlocksetServerMessage = network.NetworkServerMessage<
  BlocksetNetworkCommand,
  BlocksetSnapshot,
  AssetRoomNotice
>;

export type BlocksetRoom = network.Room<
  BlocksetNetworkCommand,
  BlocksetServerMessage
>;
