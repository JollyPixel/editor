# PixelSyncServer

Headless, server-authoritative pixel sync manager. Has no DOM/Canvas2D dependency and runs in Node.js, Deno, or Bun.

Workflow:
1. `connect(client)`: register a peer; notifies existing peers. Sends no buffer data.
2. `subscribe(clientId, bufferId)`: sends that buffer's current snapshot, if it exists.
3. `receive(cmd)`: validate, apply to the world, and broadcast to subscribers of that buffer.
4. `disconnect(clientId)`: remove the client and notify peers.

## Types

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  /**
   * Existing PixelWorld to use as the authoritative state.
   * A new (empty) world is created when omitted.
   */
  world?: PixelWorld;
  /**
   * Custom conflict resolver.
   * Defaults to LastWriteWinsResolver.
   */
  conflictResolver?: PixelConflictResolver;
}

/**
 * A connected client handle. The consumer creates these objects and passes
 * them to PixelSyncServer.connect(). The server calls send() to transmit
 * data back to the real network peer.
 */
interface ClientHandle {
  readonly id: string;
  /**
   * Transmit data to this client over the underlying transport.
   * The consumer is responsible for framing (JSON-stringify, etc.).
   */
  send(data: unknown): void;
}

type PixelStrokeCommand = Extract<PixelNetworkCommand, { action: "stroke"; }>;
```

## Properties

### `world`

```ts
readonly world: PixelWorld
```

The authoritative [`PixelWorld`](./PixelWorld.md) instance.

## Methods

### `connect` / `disconnect`

```ts
connect(client: ClientHandle): void
disconnect(clientId: string): void
```

`connect` registers the client and notifies existing peers (`{ type: "peer-joined", peerId }`); sends no buffer data. `disconnect` removes the client and notifies remaining peers (`{ type: "peer-left", peerId }`).

---

### `subscribe` / `unsubscribe`

```ts
subscribe(clientId: string, bufferId: string): void
unsubscribe(clientId: string, bufferId: string): void
```

`subscribe` subscribes the client to a buffer's future updates and immediately sends its current snapshot (`{ type: "snapshot", bufferId, data }`), if the buffer already exists. `unsubscribe` stops broadcasting that buffer's updates to the client.

---

### `receive`

```ts
receive(cmd: PixelNetworkCommand): void
```

Processes an incoming command:
- `"buffer-added"`: creates the buffer if it doesn't already exist, then broadcasts.
- `"buffer-removed"`: deletes the buffer and its conflict-tracking state, then broadcasts.
- `"stroke"`: resolves conflicts per-pixel (see [ConflictResolver](./ConflictResolver.md)); applies and broadcasts only the accepted pixels. Dropped entirely (no broadcast) if nothing was accepted.
- `"resized"` / `"texture-replaced"`: always accepted, applied, and broadcast.

Commands targeting an unknown buffer (other than `"buffer-added"`) are dropped.

---

### `snapshot`

```ts
snapshot(bufferId: string): PixelBufferSnapshot | undefined
```

Returns the buffer's current state, or `undefined` if it doesn't exist.

## Example

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
