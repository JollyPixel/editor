// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  PixelBufferHookEvent
} from "../buffer/hooks.ts";
import type { UVRegion } from "../uv/UVRegion.ts";
import type { Vec2 } from "../types.ts";

export interface PixelBufferSnapshot {
  size: Vec2;
  /**
   * Base64-encoded RGBA data.
   */
  pixels: string;
  uvRegions: UVRegion[];
}
export type PixelNetworkCommand = PixelBufferHookEvent & network.NetworkCommandHeader;

export type PixelServerMessage = network.NetworkServerMessage<
  PixelNetworkCommand,
  PixelBufferSnapshot
>;
