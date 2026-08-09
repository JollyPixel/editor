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
import type { Vec2 } from "../types.ts";

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
 * A peer's in-progress (uncommitted) UV region drag — forwarded verbatim
 * from `UVMap`'s `"region-dragging"` event.
 */
export interface UVGhostPayload {
  id: string;
  face: UVFace | null;
  geometry: UVGeometry;
}
