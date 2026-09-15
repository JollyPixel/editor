// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  AssetRoomDeletedMessage,
  AssetRoomRejectedMessage
} from "@jolly-pixel/asset-server/kinds";
import type {
  PixelBufferHookEvent,
  PixelBufferSnapshot,
  SelectionRect,
  UVSlot,
  UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";

export type { PixelBufferSnapshot };

export type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

export type PixelAssetNotice =
  | AssetRoomDeletedMessage
  | AssetRoomRejectedMessage;

export type PixelServerMessage = network.NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot,
  PixelAssetNotice
>;

export interface UVGhostPayload {
  id: string;
  face: UVSlot | null;
  geometry: UVGeometry;
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
