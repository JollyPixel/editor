// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  PixelBufferHookEvent,
  PixelBufferSnapshot,
  SelectionRect,
  UVSlot,
  UVGeometry
} from "@jolly-pixel/pixel-draw.renderer";

export type { PixelBufferSnapshot };

export type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

export type PixelServerMessage = network.NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot
>;

export interface UVGhostPayload {
  id: string;
  face: UVSlot | null;
  geometry: UVGeometry;
}

/**
 * Carries geometry only; peers sample colors from shared pre-commit state.
 */
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
    /**
     * Mirrors local blanking state, which geometry alone cannot determine.
     */
    blankSource: boolean;
  };
