// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  PixelBufferHookEvent
} from "../buffer/hooks.ts";
import type {
  UVFace,
  UVGeometry,
  UVRegionData
} from "../uv/UVRegion.ts";
import type { SelectionRect, Vec2 } from "../types.ts";

export interface PixelBufferSnapshot {
  size: Vec2;
  /**
   * Base64-encoded RGBA data.
   */
  pixels: string;
  uvRegions: UVRegionData[];
}
export type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

export type PixelServerMessage = network.NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot
>;

/**
 * A peer's in-progress UV region drag forwarded from UVMap "region-dragging".
 */
export interface UVGhostPayload {
  id: string;
  face: UVFace | null;
  geometry: UVGeometry;
}

/**
 * A peer's in-progress selection drag - geometry only, no pixel colors.
 * Receivers sample moved-block colors from their own buffer at sourceRect,
 * which is valid because both sides share the same buffer state until commit.
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
     * Whether source footprint renders blanked during move - mirrors
     * FloatingOverlayOptions.blankSource locally. Not derivable from
     * geometry alone (depends on prior gesture history).
     */
    blankSource: boolean;
  };
