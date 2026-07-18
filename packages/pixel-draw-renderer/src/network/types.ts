// Import Internal Dependencies
import type { PixelBufferHookEvent } from "../buffer/hooks.ts";
import type { Vec2 } from "../types.ts";

/**
 * Buffer create/destroy events. A PixelArtCanvas has no concept of a bufferId
 * so these are never emitted from a PixelArtCanvas's onBufferUpdated hook —
 * they are constructed directly by PixelSyncSession.createBuffer/removeBuffer.
 */
export type PixelLifecycleEvent =
  | {
    action: "buffer-added";
    metadata: {
      size: Vec2;
      /** Base64-encoded RGBA bytes for the buffer's initial content, if any. */
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
  /** Monotonically increasing sequence number per client. */
  seq: number;
  /** Unix timestamp in milliseconds when the command was created. */
  timestamp: number;
}

/**
 * A network command is a buffer event enriched with routing metadata.
 * It can be sent over any transport (WebSocket, WebRTC, Partykit, etc.).
 */
export type PixelNetworkCommand = PixelNetworkEvent & PixelNetworkCommandHeader;

export interface PixelBufferSnapshot {
  size: Vec2;
  /** Base64-encoded RGBA bytes. */
  pixels: string;
}
