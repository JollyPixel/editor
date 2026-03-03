// Import Internal Dependencies
import type { VoxelNetworkCommand } from "./types.ts";
import type { VoxelWorldJSON } from "../serialization/VoxelSerializer.ts";

/**
 * Transport-agnostic interface for sending and receiving voxel network commands.
 *
 * Consumers implement this interface with a concrete transport layer
 * (WebSocket, WebRTC, Partykit, BroadcastChannel, etc.) and pass an instance
 * to `VoxelSyncClient`.
 *
 * @example
 * ```ts
 * class MyWebSocketTransport implements VoxelTransport {
 *   readonly localClientId = crypto.randomUUID();
 *   onCommand: ((cmd: VoxelNetworkCommand) => void) | null = null;
 *   onSnapshot: ((snapshot: VoxelWorldJSON) => void) | null = null;
 *   onPeerJoined: ((peerId: string) => void) | null = null;
 *   onPeerLeft: ((peerId: string) => void) | null = null;
 *
 *   constructor(private ws: WebSocket) {
 *     ws.addEventListener("message", (ev) => {
 *       const msg = JSON.parse(ev.data);
 *       if (msg.type === "snapshot") this.onSnapshot?.(msg.data);
 *       else if (msg.type === "command") this.onCommand?.(msg.data);
 *       else if (msg.type === "peer-joined") this.onPeerJoined?.(msg.peerId);
 *       else if (msg.type === "peer-left") this.onPeerLeft?.(msg.peerId);
 *     });
 *   }
 *
 *   sendCommand(cmd: VoxelNetworkCommand): void {
 *     this.ws.send(JSON.stringify({ type: "command", data: cmd }));
 *   }
 *
 *   requestSnapshot(): void {
 *     this.ws.send(JSON.stringify({ type: "snapshot-request" }));
 *   }
 * }
 * ```
 */
export interface VoxelTransport {
  /** The client ID assigned to the local peer by the transport layer. */
  readonly localClientId: string;

  /** Sends a local mutation command to the server / peers. */
  sendCommand(cmd: VoxelNetworkCommand): void;

  /** Requests the current world snapshot from the server. */
  requestSnapshot(): void;

  /**
   * Called by the transport when a command arrives from a remote peer.
   * Set this before connecting.
   */
  onCommand: ((cmd: VoxelNetworkCommand) => void) | null;

  /**
   * Called by the transport when the server sends a full world snapshot.
   * Set this before connecting.
   */
  onSnapshot: ((snapshot: VoxelWorldJSON) => void) | null;

  /**
   * Called when a new peer joins the session.
   * Set this to react to presence changes.
   */
  onPeerJoined: ((peerId: string) => void) | null;

  /**
   * Called when a peer leaves the session.
   * Set this to react to presence changes.
   */
  onPeerLeft: ((peerId: string) => void) | null;
}
