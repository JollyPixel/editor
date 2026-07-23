# PixelSyncServer

Headless, server-authoritative sync manager for a single pixel buffer. Has no DOM/Canvas2D dependency and runs in Node.js, Deno, or Bun.

It is a [`NetworkPlugin`](https://github.com/JollyPixel/editor/tree/main/packages/network) (from `@jolly-pixel/network`) registered under its own namespace (`"pixel-draw"` by default), so it never talks to a transport directly — it's injected into a `NetworkServer`, which owns client lifecycle and can host other workspaces (e.g. a voxel sync plugin) on the same connection/port.

**One instance owns exactly one buffer.** Syncing several buffers (e.g. multiple open tilesets) means registering one `PixelSyncServer` per buffer, each under a distinct namespace — e.g. `"pixel-draw:tileset-1"`, `"pixel-draw:tileset-2"`. `NetworkServer` keys plugins by namespace, so two instances can't share the default `"pixel-draw"` name. Registration is currently static (every instance is constructed and registered up front, e.g. in Vite server config); dynamically spinning up a buffer's `PixelSyncServer` at runtime is a future extension.

Workflow, driven by `NetworkServer` once a client joins this server's namespace:
1. `attach(broadcast)`: called once by `NetworkServer.register()`, before any client connects — hands the server a function that fans a payload out to every client currently joined to its namespace. `PixelSyncServer` keeps no client list of its own; `NetworkServer` already tracks namespace membership.
2. `onClientConnect(client)`: immediately sends the buffer's current snapshot to that one client.
3. `onMessage(clientId, payload)`: validates the payload is a `PixelNetworkCommand` and forwards it to `receive`.
4. `receive(cmd)`: validates, resolves conflicts, applies the command to the buffer, and broadcasts it via the function from `attach()`.
5. `onClientDisconnect(clientId)`: no-op — there's no per-client state to clean up.

Peer presence (`peer-joined`/`peer-left` notifications for other clients on the same namespace) is handled by `NetworkServer` itself, before/after these hooks run — `PixelSyncServer` never sees or sends that traffic. Consumers hook it via `NetworkChannel.onPeerJoined`/`onPeerLeft` client-side (`WebSocketPixelTransport.onPeerJoined`/`onPeerLeft` forward them).

## Types

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  /**
   * NetworkPlugin namespace this server is registered under.
   * @default "pixel-draw"
   */
  namespace?: string;
  /**
   * Existing PixelBuffer to use as the authoritative state.
   * A new, blank 1x1 buffer is created when omitted.
   */
  buffer?: PixelBuffer;
  /**
   * Custom conflict resolver.
   * Defaults to LastWriteWinsResolver.
   */
  conflictResolver?: PixelConflictResolver;
}

/**
 * A connected client handle, re-exported from `@jolly-pixel/network`. The
 * consumer never constructs these directly — a NetworkServer builds one,
 * scoped to this server's namespace, and passes it to
 * PixelSyncServer.onClientConnect().
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
type PixelSelectEditCommand = Extract<PixelNetworkCommand, { action: "select-edit"; }>;
```

## Properties

### `buffer`

```ts
readonly buffer: PixelBuffer
```

The authoritative [`PixelBuffer`](../buffer/PixelBuffer.md) instance.

### `namespace`

```ts
readonly namespace: string
```

The `NetworkPlugin` namespace this server was registered under.

## Methods

### `attach`

```ts
attach(broadcast: (payload: unknown) => void): void
```

`NetworkPlugin` lifecycle hook, called once by `NetworkServer.register()`. `broadcast` sends a payload to every client currently joined to this server's namespace — `NetworkServer` already tracks that membership internally, so `PixelSyncServer` doesn't duplicate it. Never call this directly; it's how `receive()`'s broadcasts reach clients.

---

### `onClientConnect` / `onClientDisconnect`

```ts
onClientConnect(client: ClientHandle): void
onClientDisconnect(clientId: string): void
```

`NetworkPlugin` lifecycle hooks, called by `NetworkServer` once a client joins/leaves this server's namespace — never call these directly against a raw transport connection. `onClientConnect` immediately sends the buffer's current snapshot to that client (`{ type: "snapshot", data }`); it does not need to record the client anywhere since `attach()`'s broadcast function handles fan-out. `onClientDisconnect` is a no-op for the same reason. Neither hook notifies peers — `NetworkServer` broadcasts `peer-joined`/`peer-left` to the other joined clients on its own, around these calls.

---

### `onMessage`

```ts
onMessage(clientId: string, payload: unknown): void
```

`NetworkPlugin` lifecycle hook, called by `NetworkServer` for every message a joined client sends on this server's namespace. Validates the payload looks like a `PixelNetworkCommand` and forwards it to `receive`; malformed payloads are dropped.

---

### `receive`

```ts
receive(cmd: PixelNetworkCommand): void
```

Processes an incoming command:
- `"stroke"` / `"select-edit"`: resolves conflicts per-pixel (see [ConflictResolver](./ConflictResolver.md)), sharing the same per-pixel history as each other — a select-edit and a concurrent stroke touching the same pixel compete just like two strokes would. Applies and broadcasts only the accepted pixels (for `"select-edit"`, positions and their per-pixel colors are filtered in lockstep). Dropped entirely (no broadcast) if nothing was accepted.
- `"uv-region-moved"` / `"uv-region-deleted"`: resolves conflicts per region id — the same `PixelConflictResolver` as strokes, keyed by region id instead of `x,y`. Rejected entirely (no partial application; a region is one atomic unit, unlike a stroke's many pixels).
- `"uv-region-created"`: always accepted, applied, and broadcast — ids are unique per creation, so there's nothing to arbitrate.
- `"resized"` / `"texture-replaced"` / `"global-fill"`: always accepted, applied, and broadcast. `"global-fill"` carries no position list, so it can't be arbitrated per pixel; see [ConflictResolver](./ConflictResolver.md).

---

### `snapshot`

```ts
snapshot(): PixelBufferSnapshot
```

Returns the buffer's current state — pixels and its full current UV region set (`uvRegions`).

## Example

`PixelSyncServer` is injected into a `NetworkServer`, which handles the WebSocket transport, client lifecycle, and namespace routing. See `vite.config.ts` for the dev-server wiring:

```ts
import { NetworkServer } from "@jolly-pixel/network";
import { websocketVitePlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { PixelSyncServer, PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

const server = new NetworkServer();
server.register(new PixelSyncServer({
  namespace: "pixel-draw:demo-canvas",
  buffer: new PixelBuffer({ size: { x: 80, y: 80 } })
}));

export default {
  plugins: [websocketVitePlugin({ server })]
};
```

A second buffer registers alongside it on the same `NetworkServer`/port, under its own namespace:

```ts
server.register(new PixelSyncServer({
  namespace: "pixel-draw:tileset-2",
  buffer: new PixelBuffer({ size: { x: 32, y: 32 } })
}));
```

Another workspace entirely (e.g. a voxel sync plugin) registers the same way, under its own unrelated namespace — no changes to `PixelSyncServer` or the transport are needed.
