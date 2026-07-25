// Import Internal Dependencies
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "./types.ts";

/**
 * Transport-agnostic interface for sending and receiving voxel network commands.
 */
export interface VoxelTransport {
  readonly clientId: string;

  send(cmd: VoxelNetworkCommand): void;

  onMessage: ((message: VoxelServerMessage) => void) | null;
  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
