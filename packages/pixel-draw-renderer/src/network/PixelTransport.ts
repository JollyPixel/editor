// Import Internal Dependencies
import type { PixelBufferSnapshot, PixelNetworkCommand } from "./types.ts";

/**
 * Transport-agnostic interface for sending and receiving pixel network commands.
 *
 * Consumers implement this interface with a concrete transport layer
 * (WebSocket, WebRTC, Partykit, BroadcastChannel, etc.) and pass an instance
 * to PixelSyncSession.
 */
export interface PixelTransport {
  /** The client ID assigned to the local peer by the transport layer. */
  readonly localClientId: string;

  /** Sends a local mutation or lifecycle command to the server / peers. */
  sendCommand(
    command: PixelNetworkCommand
  ): void;
  subscribe(bufferId: string): void;
  unsubscribe(bufferId: string): void;

  /**
   * Called by the transport when a command arrives from a remote peer.
   * Set this before connecting.
   */
  onCommand: ((command: PixelNetworkCommand) => void) | null;

  /**
   * Called by the transport when the server sends a buffer snapshot
   * (in response to subscribe). Set this before connecting.
   */
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null;

  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
