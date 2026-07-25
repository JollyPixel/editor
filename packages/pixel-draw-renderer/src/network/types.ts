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

export type PixelPeerIdentity = Record<string, unknown>;

export type PixelPeerPresence = Record<string, unknown>;

export interface PixelPeer {
  readonly clientId: string;
  readonly identity: PixelPeerIdentity;
  readonly presence: PixelPeerPresence;
}

export interface PixelPresenceChannel {
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, PixelPeer>;

  updatePresence(
    patch: PixelPeerPresence
  ): void;

  onPeerJoined: ((clientId: string) => void) | null;
  onPeerLeft: ((clientId: string) => void) | null;
  onPeerPresence: ((clientId: string, patch: PixelPeerPresence) => void) | null;
}
