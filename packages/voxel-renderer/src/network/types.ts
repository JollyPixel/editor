// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";

export interface VoxelNetworkCommandHeader {
  /** Unique identifier for the originating client. */
  clientId: string;
  /** Monotonically increasing sequence number per client. */
  seq: number;
  /** Unix timestamp in milliseconds when the command was created. */
  timestamp: number;
}

/**
 * A network command is a hook event enriched with routing metadata.
 * It can be sent over any transport (WebSocket, WebRTC, Partykit, etc.).
 */
export type VoxelNetworkCommand = VoxelNetworkCommandHeader & VoxelLayerHookEvent;

/** Sent by a client that has just joined and needs the current world state. */
export interface VoxelSnapshotRequest {
  clientId: string;
}
