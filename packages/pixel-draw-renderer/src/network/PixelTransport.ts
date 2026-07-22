// Import Internal Dependencies
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand
} from "./types.ts";

/**
 * Sends and receives pixel network commands for a single buffer.
 */
export interface PixelTransport {
  /**
   * Identifies the local peer.
   */
  readonly localClientId: string;

  /**
   * Sends a local command.
   */
  sendCommand(
    command: PixelNetworkCommand
  ): void;

  /**
   * Receives a command from a remote peer.
   */
  onCommand: ((command: PixelNetworkCommand) => void) | null;

  /**
   * Receives the buffer's current snapshot, sent once by the server right
   * after connecting.
   */
  onSnapshot: ((snapshot: PixelBufferSnapshot) => void) | null;

  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
