// Import Internal Dependencies
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand
} from "./types.ts";

/**
 * Sends and receives pixel network commands.
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
  subscribe(bufferId: string): void;
  unsubscribe(bufferId: string): void;

  /**
   * Receives a command from a remote peer.
   */
  onCommand: ((command: PixelNetworkCommand) => void) | null;

  /**
   * Receives a buffer snapshot.
   */
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null;

  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
