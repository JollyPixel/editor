# PixelTransport

Transport-agnostic interface for sending and receiving pixel network commands for a single buffer. Consumers implement it with a concrete transport layer (WebSocket, WebRTC, Partykit, BroadcastChannel, etc.), already scoped to that buffer's `PixelSyncServer` namespace, and pass an instance to [`PixelSyncSession`](./PixelSyncSession.md).

## Types

```ts
interface PixelTransport {
  /** The client ID assigned to the local peer by the transport layer. */
  readonly localClientId: string;

  /** Sends a local mutation command to the server / peers. */
  send(command: PixelNetworkCommand): void;

  /**
   * Called by the transport when the buffer's snapshot arrives (once, right
   * after connecting) or when a command arrives from a remote peer. Set this
   * before connecting.
   */
  onMessage: ((message: PixelServerMessage) => void) | null;

  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}

type PixelServerMessage =
  | { type: "snapshot"; data: PixelBufferSnapshot; }
  | { type: "command"; data: PixelNetworkCommand; };
```

## `@jolly-pixel/network` example

A [`NetworkChannel`](https://github.com/JollyPixel/editor/blob/main/packages/network/docs/NetworkChannel.md) obtained from `NetworkClient.channel()` already satisfies this interface structurally — `send`/`onMessage`/`onPeerJoined`/`onPeerLeft`/`localClientId` all line up — so no adapter class is needed:

```ts
import { NetworkClient } from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const client = new NetworkClient({ url: "ws://localhost:5173/ws-sync" });
const transport = client.channel<PixelNetworkCommand, PixelServerMessage>(
  "pixel-draw:my-canvas"
);

const session = new PixelSyncSession({ transport });
session.attach(canvasManager);
```

## WebSocket example stub (without `@jolly-pixel/network`)

```ts
import type {
  PixelTransport,
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

class WebSocketTransport implements PixelTransport {
  readonly localClientId = crypto.randomUUID();
  onMessage: ((message: PixelServerMessage) => void) | null = null;
  onPeerJoined: ((peerId: string) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case "snapshot":
        case "command": this.onMessage?.(msg); break;
        case "peer-joined": this.onPeerJoined?.(msg.peerId); break;
        case "peer-left": this.onPeerLeft?.(msg.peerId); break;
      }
    });
  }

  send(cmd: PixelNetworkCommand): void {
    this.ws.send(JSON.stringify({ type: "command", data: cmd }));
  }
}
```
