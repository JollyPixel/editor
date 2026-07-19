// Import Internal Dependencies
import type {
  PixelBufferHookEvent
} from "../buffer/hooks.ts";
import type { Vec2 } from "../types.ts";

/**
 * Describes buffer lifecycle events.
 */
export type PixelLifecycleEvent =
  | {
    action: "buffer-added";
    metadata: {
      size: Vec2;
      /**
       * Base64-encoded initial RGBA data.
       */
      pixels?: string;
    };
    originTimestamp?: number;
  }
  | {
    action: "buffer-removed";
    metadata: Record<string, never>;
    originTimestamp?: number;
  };

export type PixelNetworkEvent = PixelBufferHookEvent | PixelLifecycleEvent;

export interface PixelNetworkCommandHeader {
  bufferId: string;
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
}
