# PixelTransport

Transport-agnostic interface for sending and receiving pixel network commands for a single buffer. Consumers implement it with a concrete transport layer (WebSocket, WebRTC, Partykit, BroadcastChannel, etc.), already scoped to that buffer's `PixelSyncServer` namespace, and pass an instance to [`PixelSyncSession`](./PixelSyncSession.md).

## Types

```ts
interface PixelTransport {
  /** The client ID assigned to the local peer by the transport layer. */
  readonly localClientId: string;

  /** Sends a local mutation command to the server / peers. */
  sendCommand(command: PixelNetworkCommand): void;

  /**
   * Called by the transport when a command arrives from a remote peer.
   * Set this before connecting.
   */
  onCommand: ((command: PixelNetworkCommand) => void) | null;

  /**
   * Called by the transport when the server sends the buffer's snapshot,
   * once right after connecting. Set this before connecting.
   */
  onSnapshot: ((snapshot: PixelBufferSnapshot) => void) | null;

  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
```

## WebSocket example stub

```ts
import type {
  PixelTransport,
  PixelNetworkCommand,
  PixelBufferSnapshot
} from "@jolly-pixel/pixel-draw.renderer";

class WebSocketTransport implements PixelTransport {
  readonly localClientId = crypto.randomUUID();
  onCommand: ((cmd: PixelNetworkCommand) => void) | null = null;
  onSnapshot: ((snapshot: PixelBufferSnapshot) => void) | null = null;
  onPeerJoined: ((peerId: string) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case "snapshot": this.onSnapshot?.(msg.data); break;
        case "command": this.onCommand?.(msg.data); break;
        case "peer-joined": this.onPeerJoined?.(msg.peerId); break;
        case "peer-left": this.onPeerLeft?.(msg.peerId); break;
      }
    });
  }

  sendCommand(cmd: PixelNetworkCommand): void {
    this.ws.send(JSON.stringify({ type: "command", data: cmd }));
  }
}
```
