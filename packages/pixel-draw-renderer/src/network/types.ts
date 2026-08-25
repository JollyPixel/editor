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
   * Base64-encoded RGBA8 data.
   */
  pixels: string;
  uvRegions: UVRegionData[];
}
export type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

export type PixelServerMessage = network.NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot
>;

export interface UVGhostPayload {
  id: string;
  face: UVFace | null;
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
