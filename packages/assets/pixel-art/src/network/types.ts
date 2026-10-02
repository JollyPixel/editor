// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
  PixelBufferHookEvent,
  PixelBufferSnapshot,
  PngPixels,
  RGBA8,
  SelectionRect,
  UVSlot,
  UVLayoutData
} from "@jolly-pixel/pixel-draw.renderer";

export type { PixelBufferSnapshot };

export interface PixelWireSnapshot extends Omit<PixelBufferSnapshot, "pixels"> {
  pixels: string | PngPixels;
}

export type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

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
    originTimestamp?: number;
  }
  | {
    action: "select-edit";
    metadata: PackedSelectEditMetadata;
    originTimestamp?: number;
  };

export type PixelWireEvent = PixelBufferHookEvent | PackedPixelEvent;

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

export interface StrokeGhostSpan {
  color: RGBA8;
  xy: number[];
}

export interface StrokeGhostFrame {
  from: number;
  spans: StrokeGhostSpan[];
}

export interface UVGhostPayload {
  id: string;
  face: UVSlot | null;
  layout: UVLayoutData;
}

export type SelectionGhostPayload =
  | {
    phase: "creating";
    rect: SelectionRect;
  }
  | {
    phase: "moving";
    sourceRect: SelectionRect;
    liveRect: SelectionRect;
    mask: boolean[];
    blankSource: boolean;
  };
