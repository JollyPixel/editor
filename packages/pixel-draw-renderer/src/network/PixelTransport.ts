// Import Internal Dependencies
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

/**
 * Sends and receives pixel network commands for a single buffer.
 */
export interface PixelTransport {
  readonly clientId: string;

  send(
    command: PixelNetworkCommand
  ): void;

  onMessage: ((message: PixelServerMessage) => void) | null;
  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
