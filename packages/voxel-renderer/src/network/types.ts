// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";

export interface VoxelNetworkCommandHeader {
  clientId: string;
  seq: number;
  timestamp: number;
}

export type VoxelNetworkCommand = VoxelNetworkCommandHeader & VoxelLayerHookEvent;

/**
 * Wire envelope a transport delivers to `VoxelTransport.onMessage`: either
 * the world's initial snapshot, or a live command from a peer.
 */
export type VoxelServerMessage =
  | { type: "snapshot"; data: VoxelWorldJSON; }
  | { type: "command"; data: VoxelNetworkCommand; };
