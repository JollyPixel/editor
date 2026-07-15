# Network Sync Layer

Transport-agnostic, server-authoritative multiplayer for CanvasManager. Multiple
clients can share the same texture(s) in real time. Structurally mirrors
`@jolly-pixel/voxel.renderer`'s network layer but is an independent
implementation — this package has no dependency on voxel-renderer.

## Architecture

```
┌───────────────┐  onBufferUpdated   ┌──────────────────┐   sendCommand   ┌─────────────┐
│ CanvasManager │───────────────────▶│ PixelSyncSession │────────────────▶│  Transport  │
│  (per buffer) │                    │  (multi-buffer)  │◀────────────────│ (WebSocket, │
│               │◀──applyRemote──────│                  │   onCommand     │  WebRTC, …) │
└───────────────┘                    └──────────────────┘                 └──────┬──────┘
                                                                                  │ wire
                                                                                  ▼
                                                                       ┌──────────────────┐
                                                                       │  PixelSyncServer │
                                                                       │    (headless)    │
                                                                       │    PixelWorld    │
                                                                       └──────────────────┘
```

A `CanvasManager` has no concept of a buffer identity — it owns exactly one
texture. `PixelSyncSession` assigns that texture a `bufferId` and can attach
several `CanvasManager` instances to the same transport connection (e.g. one
per open tileset).

**Flow:**
1. A local mutation (a paint stroke, resize, or `setTexture`) fires
   `CanvasManager.onBufferUpdated`.
2. `PixelSyncSession` stamps the event with `bufferId / clientId / seq /
   timestamp` and calls `transport.sendCommand(cmd)`.
3. The transport delivers the command to `PixelSyncServer.receive()`.
4. The server resolves conflicts, applies the command to its authoritative
   `PixelWorld`, and broadcasts it to clients subscribed to that buffer.
5. Each subscribed client's transport calls `onCommand(cmd)`, which
   `PixelSyncSession` routes to the matching `CanvasManager.applyRemoteCommand()`.
6. `applyRemoteCommand` suppresses `onBufferUpdated` while applying, so the
   result is never re-broadcast — no echo loop.

Buffers are not sent in bulk. A client receives a buffer's pixel data only
when it subscribes to that specific `bufferId` (via `attach`/`createBuffer`).

## PixelTransport interface

```ts
interface PixelTransport {
  readonly localClientId: string;
  sendCommand(cmd: PixelNetworkCommand): void;
  subscribe(bufferId: string): void;
  unsubscribe(bufferId: string): void;
  onCommand: ((cmd: PixelNetworkCommand) => void) | null;
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null;
  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
```

### WebSocket example stub

```ts
import type {
  PixelTransport,
  PixelNetworkCommand,
  PixelBufferSnapshot
} from "@jolly-pixel/pixel-draw.renderer";

class WebSocketTransport implements PixelTransport {
  readonly localClientId = crypto.randomUUID();
  onCommand: ((cmd: PixelNetworkCommand) => void) | null = null;
  onSnapshot: ((bufferId: string, snapshot: PixelBufferSnapshot) => void) | null = null;
  onPeerJoined: ((peerId: string) => void) | null = null;
  onPeerLeft: ((peerId: string) => void) | null = null;

  constructor(private ws: WebSocket) {
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string);
      switch (msg.type) {
        case "snapshot": this.onSnapshot?.(msg.bufferId, msg.data); break;
        case "command": this.onCommand?.(msg.data); break;
        case "peer-joined": this.onPeerJoined?.(msg.peerId); break;
        case "peer-left": this.onPeerLeft?.(msg.peerId); break;
      }
    });
  }

  sendCommand(cmd: PixelNetworkCommand): void {
    this.ws.send(JSON.stringify({ type: "command", data: cmd }));
  }

  subscribe(bufferId: string): void {
    this.ws.send(JSON.stringify({ type: "subscribe", bufferId }));
  }

  unsubscribe(bufferId: string): void {
    this.ws.send(JSON.stringify({ type: "unsubscribe", bufferId }));
  }
}
```

## PixelSyncSession

```ts
import { fromUint8Array } from "js-base64";
import {
  PixelSyncSession
} from "@jolly-pixel/pixel-draw.renderer";

const session = new PixelSyncSession({ transport: myTransport });

// Attach an existing texture, assumed to already exist on the server.
// Subscribes and receives its snapshot asynchronously via onSnapshot.
session.attach("tileset-1", canvasManager);

// Attach AND announce a brand new buffer, seeding peers with its current pixels.
session.createBuffer("tileset-2", otherCanvasManager, {
  size: otherCanvasManager.getTextureSize(),
  pixels: fromUint8Array(new Uint8Array(otherCanvasManager.getTexture()))
});

session.onBufferAdded = (bufferId, metadata) => {
  // A peer created a new buffer this client hasn't attached to.
};
session.onBufferRemoved = (bufferId) => {
  // A peer removed a buffer.
};

// Stop syncing a texture (e.g. the user closed that tab).
session.detach("tileset-1");
// Same, but also tells peers the buffer is gone.
session.removeBuffer("tileset-2");

session.destroy();
```

One `PixelSyncSession` per transport connection. Each `CanvasManager` is
attached under exactly one `bufferId`.

## PixelSyncServer

Headless — no DOM/Canvas2D dependency. Runs in Node.js, Deno, or Bun.

```ts
import {
  PixelSyncServer,
  type ClientHandle
} from "@jolly-pixel/pixel-draw.renderer";
import { WebSocketServer } from "ws";

const server = new PixelSyncServer();
const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws) => {
  const client: ClientHandle = {
    id: crypto.randomUUID(),
    send: (data) => ws.send(JSON.stringify(data))
  };

  server.connect(client);

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    switch (msg.type) {
      case "command": server.receive(msg.data); break;
      case "subscribe": server.subscribe(client.id, msg.bufferId); break;
      case "unsubscribe": server.unsubscribe(client.id, msg.bufferId); break;
    }
  });

  ws.on("close", () => server.disconnect(client.id));
});
```

| Method | Description |
|---|---|
| `connect(client)` | Registers the client, notifies existing peers. Sends no buffer data. |
| `disconnect(clientId)` | Removes the client, notifies remaining peers. |
| `subscribe(clientId, bufferId)` | Subscribes the client to a buffer's updates and sends its current snapshot, if it exists. |
| `unsubscribe(clientId, bufferId)` | Stops broadcasting that buffer's updates to the client. |
| `receive(cmd)` | Validates, applies, and broadcasts a command to that buffer's subscribers. |
| `snapshot(bufferId)` | Returns the buffer's current state as `PixelBufferSnapshot`, or `undefined`. |
| `world` | The authoritative `PixelWorld` instance. |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `world` | `PixelWorld` | new world | Existing world to use as authoritative state. |
| `conflictResolver` | `PixelConflictResolver` | `LastWriteWinsResolver` | Custom conflict strategy. |

## PixelNetworkCommand — wire format

```ts
type PixelNetworkCommand = (PixelBufferHookEvent | PixelLifecycleEvent) & {
  bufferId: string;
  clientId: string;
  seq: number;
  timestamp: number;
};
```

Five actions: `"buffer-added"`, `"buffer-removed"`, `"stroke"`, `"resized"`,
`"texture-replaced"`. All pixel payloads (`stroke` positions excepted) are
raw RGBA bytes, base64-encoded via `js-base64` — no image codec dependency, so
`PixelSyncServer` stays headless. Commands are plain JSON-serializable
objects.

A `"stroke"` command carries one color and a deduped list of pixel
positions for an entire paint stroke (mouse-down to mouse-up), not one
command per brush stamp.

## ConflictResolver

Conflicts are resolved **per pixel**, not per command — a single stroke
command can touch thousands of pixels, so a command is split: pixels that
lose the race are dropped from the applied/broadcast copy, the rest are
applied normally. `"buffer-added"`, `"buffer-removed"`, `"resized"`, and
`"texture-replaced"` are structural and always accepted.

### Default: LastWriteWinsResolver

Higher `timestamp` wins. On a tie, the lexicographically greater `clientId`
wins (deterministic without coordination).

```ts
import {
  LastWriteWinsResolver
} from "@jolly-pixel/pixel-draw.renderer";

const server = new PixelSyncServer({
  conflictResolver: new LastWriteWinsResolver() // default, no need to pass explicitly
});
```

### Custom resolver

```ts
import type {
  PixelConflictResolver,
  PixelConflictContext
} from "@jolly-pixel/pixel-draw.renderer";

class FirstWriteWinsResolver implements PixelConflictResolver {
  resolve({ existing }: PixelConflictContext): "accept" | "reject" {
    return existing ? "reject" : "accept";
  }
}

const server = new PixelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

## applyCommandToWorld — headless usage

Replays a command against a bare `PixelWorld`, without a `CanvasManager`.
Useful for server-side logic, unit tests, or offline editing tools.

```ts
import {
  PixelWorld,
  applyCommandToWorld
} from "@jolly-pixel/pixel-draw.renderer";

const world = new PixelWorld();
applyCommandToWorld(world, {
  action: "buffer-added",
  bufferId: "tileset-1",
  metadata: { size: { x: 64, y: 32 } },
  clientId: "seed",
  seq: 1,
  timestamp: Date.now()
});
```
