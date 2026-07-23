# Network Sync Layer

The network sync layer adds **server-authoritative multiplayer** on top of `VoxelEngine`, built directly on `@jolly-pixel/network`'s transport-agnostic primitives (`NetworkServer` / `NetworkPlugin` / `NetworkClient` / `NetworkChannel`). Multiple clients share the same voxel world in real time: `VoxelSyncSession` wires a `VoxelEngine` instance (standalone or via `vr.engine`) to a `NetworkChannel`-shaped transport, and `VoxelSyncServer` is a `NetworkPlugin` that owns the authoritative `VoxelWorld`.

This mirrors `@jolly-pixel/pixel-draw.renderer`'s network layer (`PixelSyncSession`/`PixelSyncServer`) — both packages share the same wire discipline and dev-server wiring pattern.

## Architecture overview

```
┌─────────────┐   local mutation   ┌───────────────────┐   send(cmd)     ┌─────────────────┐
│ VoxelEngine │──────────────────▶│ VoxelSyncSession  │────────────────▶│ NetworkChannel  │
│  (headless) │                   │                   │◀────────────────│ (NetworkClient) │
│             │◀──applyRemote──── │                   │   onMessage     │                 │
└─────────────┘                   └───────────────────┘                 └────────┬────────┘
                                                                                  │  wire (ws)
                                                                                  ▼
                                                                     ┌─────────────────────┐
                                                                     │     NetworkServer   │
                                                                     │  (namespace router) │
                                                                     └──────────┬──────────┘
                                                                                │ register()
                                                                                ▼
                                                                     ┌─────────────────────┐
                                                                     │  VoxelSyncServer    │
                                                                     │  (NetworkPlugin,    │
                                                                     │  headless, owns     │
                                                                     │  VoxelWorld)        │
                                                                     └─────────────────────┘
```

**Flow:**
1. A local mutation (e.g. `setVoxel`) fires the `onLayerUpdated` hook.
2. `VoxelSyncSession` chains onto the hook, stamps the command with `clientId` / `seq` / `timestamp`, and calls `transport.send(cmd)`.
3. `NetworkClient` forwards it over one shared WebSocket, tagged with the session's namespace.
4. `NetworkServer` routes it to the registered `VoxelSyncServer` instance for that namespace, which validates the command (LWW conflict resolution), applies it to its authoritative `VoxelWorld`, and broadcasts it to every client joined to that namespace.
5. Each client's channel calls `onMessage({ type: "command", data: cmd })`, which `VoxelSyncSession` routes to `engine.applyRemoteCommand(cmd)` (skipping its own echoed commands by `clientId`).
6. `applyRemoteCommand` sets an internal flag so that the resulting hook event is **not** re-emitted — preventing infinite echo loops.

## VoxelTransport interface

Shaped to match `@jolly-pixel/network`'s `NetworkChannel` exactly, so `NetworkClient.channel(namespace)` can be passed in directly — no adapter needed:

```ts
interface VoxelTransport {
  readonly localClientId: string;
  send(cmd: VoxelNetworkCommand): void;
  onMessage: ((message: VoxelServerMessage) => void) | null;
  onPeerJoined: ((peerId: string) => void) | null;
  onPeerLeft: ((peerId: string) => void) | null;
}
```

## Client setup

```ts
import { NetworkClient } from "@jolly-pixel/network";
import {
  VoxelSyncSession,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new NetworkClient({ url: `${wsProtocol}//${location.host}/ws-sync` });
const transport = client.channel<VoxelNetworkCommand, VoxelServerMessage>("voxel-map:world");

const session = new VoxelSyncSession({ transport });
session.attach(vr.engine); // or a standalone, headless VoxelEngine
```

`attach()` **chains** onto any existing `engine.onLayerUpdated` handler instead of replacing it — a handler set at `VoxelEngine`/`VoxelRenderer` construction time keeps firing. `detach()` restores whatever handler was present before `attach()` was called.

### Lifecycle

```ts
// When the session ends:
session.destroy(); // detach() + clears transport.onMessage
```

## Server setup — Vite dev server

`VoxelSyncServer` is a `NetworkPlugin`, registered onto a `NetworkServer` via `@jolly-pixel/network`'s `createWebSocketNetworkPlugin` Vite plugin — the same pattern `pixel-draw-renderer` uses. A single `vite dev` process then serves both the static app and the WebSocket sync endpoint:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { VoxelSyncServer } from "@jolly-pixel/voxel.renderer";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      plugins: [
        // Must match the client's namespace above.
        new VoxelSyncServer({ namespace: "voxel-map:world" })
      ]
    })
  ]
});
```

Multiple `VoxelSyncServer` instances (one per world) can be registered side by side, each under its own namespace — and alongside a `PixelSyncServer` for texture sync, since both extend the same `NetworkPlugin` base and share one `NetworkServer`/WebSocket.

> **Pre-seed the server's world to match the client's initial state.** A client typically creates a default layer locally (e.g. `VoxelEngine`'s `layers` constructor option) before its `VoxelSyncSession` has attached — that layer is never sent to the server. If the server starts with an empty `VoxelWorld`, the *first* snapshot it sends back will have zero layers, and `engine.load()` on the client wipes its local default layer out to match. Pass a pre-populated `world` (with the same layer name(s) the client bootstraps) so every client's first snapshot is already consistent — the same reason `PixelSyncServer` is typically constructed with a pre-sized `PixelBuffer` rather than a blank one:
> ```ts
> const world = new VoxelWorld(16);
> world.addLayer("Ground");
> new VoxelSyncServer({ namespace: "voxel-map:world", world });
> ```
>
> `receive()` never lets a bad command crash the server: applying a command that references a layer the server doesn't know about (e.g. a stale command from before a reconnect) is caught, logged, and dropped instead of propagating the underlying `VoxelWorld` exception (`setVoxelAt`/`removeVoxelAt` etc. throw by design for local/programmatic misuse, which would otherwise take down the shared session for every connected client over one bad command).

### API

| Method | Description |
|--------|-------------|
| `onClientConnect(client)` | Sends the current snapshot to a newly joined client (called by `NetworkServer`). |
| `onClientDisconnect(clientId)` | No-op — `NetworkServer` owns membership bookkeeping. |
| `attach(broadcast)` | Called by `NetworkServer.register()` to wire the broadcast function. |
| `onMessage(clientId, payload)` | Validates and routes an incoming payload to `receive()`. |
| `receive(cmd)` | Validates, applies, and broadcasts a command directly (useful in tests). |
| `snapshot()` | Returns the current world as `VoxelWorldJSON`. |
| `world` | The authoritative `VoxelWorld` instance. |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `namespace` | `string` | `"voxel-map"` | `NetworkPlugin` namespace this server is registered under. |
| `world` | `VoxelWorld` | new world | Existing world to use as authoritative state. |
| `chunkSize` | `number` | `16` | Chunk size when creating a new world. |
| `conflictResolver` | `VoxelConflictResolver` | `LastWriteWinsResolver` | Custom conflict strategy. |

## VoxelNetworkCommand — wire format

A `VoxelNetworkCommand` is a `VoxelLayerHookEvent` extended with routing metadata:

```ts
type VoxelNetworkCommand = VoxelLayerHookEvent & {
  clientId: string;   // originating client ID
  seq: number;        // monotonically increasing per client
  timestamp: number;  // Unix ms (Date.now()) at time of mutation
};
```

Commands and snapshots are wrapped in a `VoxelServerMessage` envelope delivered to `VoxelTransport.onMessage`:

```ts
type VoxelServerMessage =
  | { type: "snapshot"; data: VoxelWorldJSON; }
  | { type: "command"; data: VoxelNetworkCommand; };
```

## VoxelConflictResolver

### Default: LastWriteWinsResolver

The default resolver uses **timestamp** to determine which command wins at a given voxel
position. On a tie, the lexicographically greater `clientId` wins (deterministic without
coordination).

```ts
import { LastWriteWinsResolver } from "@jolly-pixel/voxel.renderer";

const server = new VoxelSyncServer({
  conflictResolver: new LastWriteWinsResolver() // default, no need to pass explicitly
});
```

### Custom resolver

Implement `VoxelConflictResolver` for custom strategies (e.g. first-write-wins, priority by
role, etc.):

```ts
import type { VoxelConflictResolver, VoxelConflictContext } from "@jolly-pixel/voxel.renderer";

class FirstWriteWinsResolver implements VoxelConflictResolver {
  resolve({ existing }: VoxelConflictContext): "accept" | "reject" {
    // Accept only if no prior command exists at this position
    return existing ? "reject" : "accept";
  }
}

const server = new VoxelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

> **Note:** Conflict resolution only applies to per-position voxel operations (`"voxel-set"`,
> `"voxel-removed"`). Structural layer operations (`"added"`, `"removed"`, `"reordered"`, etc.)
> are always accepted. Unlike `pixel-draw-renderer`'s resolver, there is no "same client always
> wins" special case — that rule exists to keep undo/redo replay from being rejected as stale,
> and `VoxelEngine` has no undo/redo or origin-timestamp concept to protect.

## VoxelCommandApplier — headless usage

`applyCommandToWorld` lets you replay hook events against a bare `VoxelWorld` without a
renderer. Useful for server-side logic, unit tests, or offline editing tools.

```ts
import { VoxelWorld, applyCommandToWorld } from "@jolly-pixel/voxel.renderer";

const world = new VoxelWorld(16);
applyCommandToWorld(world, {
  action: "added",
  layerName: "Ground",
  metadata: { options: {} }
});
applyCommandToWorld(world, {
  action: "voxel-set",
  layerName: "Ground",
  metadata: {
    position: { x: 0, y: 0, z: 0 },
    blockId: 1,
    rotation: 0,
    flipX: false,
    flipZ: false,
    flipY: false
  }
});
```
