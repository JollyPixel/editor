// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
  PixelCommand,
  PixelBufferSnapshot,
  PngPixels,
  RGBA8
} from "@jolly-pixel/pixel-draw.renderer";

export type { PixelBufferSnapshot };

export interface PixelWireSnapshot extends Omit<PixelBufferSnapshot, "pixels"> {
  pixels: string | PngPixels;
}

export type PixelNetworkCommand = PixelCommand & network.NetworkCommandHeader;

export interface PackedStrokeMetadata {
  color: RGBA8;
  xy: number[];
}

export interface PackedSelectEditMetadata {
  xy: number[];
  rgba: number[];
}

export type PackedPixelEvent =
  | {
    action: "stroke";
    metadata: PackedStrokeMetadata;
  }
  | {
    action: "select-edit";
    metadata: PackedSelectEditMetadata;
  };

export type PixelWireEvent = PixelCommand | PackedPixelEvent;

export type PixelWireCommand = PixelWireEvent & network.NetworkCommandHeader;

export type PixelServerMessage = network.NetworkServerMessage<
  PixelWireCommand,
  PixelWireSnapshot,
  AssetRoomNotice
>;

export type PixelArtRoom = network.Room<
  PixelWireCommand,
  PixelServerMessage
>;
