// Import Internal Dependencies
import type {
  PixelBufferHookEvent
} from "../buffer/hooks.ts";
import type { UVRegion } from "../uv/UVRegion.ts";
import type { Vec2 } from "../types.ts";

export type PixelNetworkEvent = PixelBufferHookEvent;

export interface PixelNetworkCommandHeader {
  clientId: string;
  /**
   * Client-local command sequence number.
   */
  seq: number;
  /**
   * Command creation time in milliseconds.
   */
  timestamp: number;
}

/**
 * Combines a network event with routing metadata.
 */
export type PixelNetworkCommand = PixelNetworkEvent & PixelNetworkCommandHeader;

export interface PixelBufferSnapshot {
  size: Vec2;
  /**
   * Base64-encoded RGBA data.
   */
  pixels: string;
  uvRegions: UVRegion[];
}

/**
 * Wire envelope a transport delivers to `PixelTransport.onMessage`: either
 * the buffer's initial snapshot, or a live command from a peer.
 */
export type PixelServerMessage =
  | { type: "snapshot"; data: PixelBufferSnapshot; }
  | { type: "command"; data: PixelNetworkCommand; };
