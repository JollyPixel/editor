# Network Sync Layer

The network sync layer adds **server-authoritative multiplayer** on top of `VoxelEngine`, built directly on `@jolly-pixel/network`'s primitives (`network.Server` / `network.Extension` / `network.Client` / `network.Room`). Multiple clients share the same voxel world in real time: `VoxelSyncClient` extends `network.SyncAdapter` to wire a `VoxelEngine` instance (standalone or via `vr.engine`) to a `network.Room`, and `VoxelSyncServer` is a `network.Extension` that owns the authoritative `VoxelWorld`.

This mirrors `@jolly-pixel/pixel-draw.renderer`'s network layer (`PixelSyncClient`/`PixelSyncServer`) — both packages share the same wire discipline and dev-server wiring pattern.

## Architecture overview

```
┌─────────────┐   local mutation   ┌───────────────────┐   send(cmd)     ┌─────────────────┐
│ VoxelEngine │──────────────────▶│  VoxelSyncClient  │────────────────▶│  network.Room   │
│  (headless) │                   │                   │◀────────────────│(network.Client) │
│             │◀──applyRemote──── │                   │   onMessage     │                 │
└─────────────┘                   └───────────────────┘                 └────────┬────────┘
                                                                                  │  wire (ws)
                                                                                  ▼
                                                                     ┌─────────────────────┐
                                                                     │    network.Server   │
                                                                     │   (room router)     │
                                                                     └──────────┬──────────┘
                                                                                │ register()
                                                                                ▼
                                                                     ┌─────────────────────┐
                                                                     │  VoxelSyncServer    │
                                                                     │(network.Extension)  │
                                                                     │  headless, owns     │
                                                                     │  VoxelWorld)        │
                                                                     └─────────────────────┘
```

**Flow:**
1. A local mutation (e.g. `setVoxel`) fires the `onLayerUpdated` hook.
2. `VoxelSyncClient` chains onto the hook, stamps the command with `clientId` / `seq` / `timestamp`, and calls `room.send(cmd)`.
3. `network.Client` forwards it over one shared WebSocket, tagged with the client's room.
4. `network.Server` routes it to the registered `VoxelSyncServer` instance for that room, which validates the command (LWW conflict resolution), applies it to its authoritative `VoxelWorld`, and broadcasts it to every client joined to that room.
5. Each client's room handle dispatches a `"message"` event with `{ type: "command", data: cmd }`, which `VoxelSyncClient` routes to `engine.applyRemoteCommand(cmd)` (skipping its own echoed commands by `clientId`).
6. `applyRemoteCommand` sets an internal flag so that the resulting hook event is **not** re-emitted — preventing infinite echo loops.

## Client setup

```ts
import * as network from "@jolly-pixel/network";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({ url: `${wsProtocol}//${location.host}/ws-sync` });
const room = client.room<VoxelNetworkCommand, VoxelServerMessage>("voxel-map:world");

const syncClient = new VoxelSyncClient({ room });
syncClient.attach(vr.engine); // or a standalone, headless VoxelEngine
```

`attach()` **chains** onto any existing `engine.onLayerUpdated` handler instead of replacing it — a handler set at `VoxelEngine`/`VoxelRenderer` construction time keeps firing. `detach()` restores whatever handler was present before `attach()` was called.

### Lifecycle

```ts
// When the sync client is no longer needed:
syncClient.destroy(); // detach() + removes its "message" listener + room.leave()
```

## Server setup — Vite dev server

`VoxelSyncServer` is a `network.Extension`, registered onto a `network.Server` via `@jolly-pixel/network`'s `createWebSocketNetworkPlugin` Vite plugin — the same pattern `pixel-draw-renderer` uses. A single `vite dev` process then serves both the static app and the WebSocket sync endpoint:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { VoxelSyncServer } from "@jolly-pixel/voxel.renderer";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        // Must match the client's room above.
        new VoxelSyncServer({ id: "voxel-map:world" })
      ]
    })
  ]
});
```

Multiple `VoxelSyncServer` instances (one per world) can be registered side by side, each under its own room — and alongside a `PixelSyncServer` for texture sync, since both extend the same `network.Extension` base and share one `network.Server`/WebSocket.

> **Pre-seed the server's world to match the client's initial state.** A client typically creates a default layer locally (e.g. `VoxelEngine`'s `layers` constructor option) before its `VoxelSyncClient` has attached — that layer is never sent to the server. If the server starts with an empty `VoxelWorld`, the *first* snapshot it sends back will have zero layers, and `engine.load()` on the client wipes its local default layer out to match. Pass a pre-populated `world` (with the same layer name(s) the client bootstraps) so every client's first snapshot is already consistent — the same reason `PixelSyncServer` is typically constructed with a pre-sized `PixelBuffer` rather than a blank one:
> ```ts
> const world = new VoxelWorld(16);
> world.addLayer("Ground");
> new VoxelSyncServer({ id: "voxel-map:world", world });
> ```
>
> `receive()` never lets a bad command crash the server: applying a command that references a layer the server doesn't know about (e.g. a stale command from before a reconnect) is caught, logged, and dropped instead of propagating the underlying `VoxelWorld` exception (`setVoxelAt`/`removeVoxelAt` etc. throw by design for local/programmatic misuse, which would otherwise take down the shared session for every connected client over one bad command).

### API

| Method | Description |
|--------|-------------|
| `onClientConnect(client)` | Sends the current snapshot to a newly joined client (called by `network.Server`). |
| `onClientDisconnect(clientId)` | No-op — `network.Server` owns membership bookkeeping. |
| `onMessage(clientId, payload, context)` | Validates and routes an incoming payload to `receive()`. |
| `getEventName(payload)` | Returns the command's `action` (or `"unknown"` for a non-`VoxelNetworkCommand` payload) — used by `network.ServerRoom` to look up rights when the server was constructed with one (see [Rights (RBAC)](#rights-rbac)). |
| `name` | Always `"voxel.renderer"`, shared by every `VoxelSyncServer` instance regardless of `id` — the namespace a rights table keys its rules against (e.g. `"voxel.renderer.*"`). |
| `events` | The full `VoxelLayerHookAction` vocabulary (`"voxel-set"`, `"object-added"`, ...) — a declarative catalog for whoever configures the server's rights table; `VoxelSyncServer` itself never decides who may use them. |
| `receive(cmd, context)` | Validates, applies, and broadcasts a command via `context.room.broadcast()` (useful in tests). |
| `snapshot()` | Returns the current world as `VoxelWorldJSON`. |
| `world` | The authoritative `VoxelWorld` instance. |

`context: network.RoomContext` is handed in per call by `network.ServerRoom` — it's not stashed anywhere, so `VoxelSyncServer` never holds broadcast capability outside of reacting to an actual client event. A server-driven push with no triggering client event (a timer, an admin action) goes through `network.Server.broadcast(roomId, payload)` instead.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | `"voxel-map"` | `network.Extension` id this server is registered under. |
| `world` | `VoxelWorld` | new world | Existing world to use as authoritative state. |
| `chunkSize` | `number` | `16` | Chunk size when creating a new world. |
| `conflictResolver` | `network.ConflictResolver<VoxelNetworkCommand>` | `network.LastWriteWinsResolver` | Custom conflict strategy. |

## Rights (RBAC)

`VoxelSyncServer` never defines roles or a rights policy itself — it only exposes its type identity via `name` (always `"voxel.renderer"`) and its action vocabulary via `events`/`getEventName()`. The rights table (which role can do what) is entirely a `network.Server` concern, configured once wherever the server is actually wired up (e.g. `vite.config.ts`, alongside `createWebSocketNetworkPlugin`), and keyed by `name` rather than by each world's `id` — one rule set covers every `VoxelSyncServer` world registered on that server:

```ts
createWebSocketNetworkPlugin({
  extensions: [
    new VoxelSyncServer({ id: "voxel-map:world-1", world }),
    new VoxelSyncServer({ id: "voxel-map:world-2" }) // same rights apply here too
  ],
  rights: {
    viewer: {
      "voxel.renderer.$join": "write",       // viewers may join...
      "voxel.renderer.$presence": "write",   //  ...and share cursor/presence...
      "voxel.renderer.voxel-set": "read",    //  ...and see edits...
      "voxel.renderer.voxel-removed": "read",
      "voxel.renderer.object-added": "read"
      // any action not listed here fails open to "write" for "viewer" too —
      // list every mutating action you actually want to restrict, or use a
      // trailing "voxel.renderer.*" to catch everything not already matched.
    },
    editor: {
      "voxel.renderer.$join": "write" // everything else falls through to the fail-open default (full write)
    }
  }
});
```

A client with no `role` in its join `identity`, or a role that isn't a key in the table, falls open to full write access — matching `@jolly-pixel/network`'s "unrestricted by default" behavior (see [Rights](../../network/docs/Rights.md)). Role assignment here is **not authenticated** — `identity.role` is whatever the client sent at `room.join()`. If real access control is needed, resolve the role from a trusted session/auth layer before constructing that `identity` client-side.

## VoxelNetworkCommand — wire format

A `VoxelNetworkCommand` is a `VoxelLayerHookEvent` extended with `@jolly-pixel/network`'s routing header:

```ts
type VoxelNetworkCommand = VoxelLayerHookEvent & network.NetworkCommandHeader;
// network.NetworkCommandHeader = {
//   clientId: string;   // originating client ID
//   seq: number;        // monotonically increasing per client
//   timestamp: number;  // Unix ms (Date.now()) at time of mutation
// }
```

Commands and snapshots are wrapped in a `VoxelServerMessage` envelope delivered via `network.Room`'s `"message"` event:

```ts
type VoxelServerMessage = network.NetworkServerMessage<VoxelNetworkCommand, VoxelWorldJSON>;
```

Both `NetworkCommandHeader` and `NetworkServerMessage` live in `@jolly-pixel/network`, shared verbatim with `pixel-draw-renderer`'s `PixelNetworkCommand`/`PixelServerMessage` — see [`SyncAdapter`](../../network/docs/sync/SyncAdapter.md).

## Conflict resolution

### Default: network.LastWriteWinsResolver

The default resolver uses **timestamp** to determine which command wins at a given voxel
position. On a tie, the lexicographically greater `clientId` wins (deterministic without
coordination). Commands from the *same* `clientId` as the last accepted one always win,
regardless of timestamp ordering — this is what keeps replayed operations (e.g. an undo/redo
system built on top of `VoxelEngine`) from being rejected as stale by their own historical
timestamp. See [Conflicts](../../network/docs/sync/Conflicts.md) for the full
rationale — the resolver is shared verbatim with `pixel-draw-renderer`.

```ts
import * as network from "@jolly-pixel/network";

const server = new VoxelSyncServer({
  conflictResolver: new network.LastWriteWinsResolver() // default, no need to pass explicitly
});
```

### Custom resolver

Implement `network.ConflictResolver<VoxelNetworkCommand>` for custom strategies (e.g. first-write-wins, priority by
role, etc.):

```ts
import type * as network from "@jolly-pixel/network";
import type { VoxelNetworkCommand } from "@jolly-pixel/voxel.renderer";

class FirstWriteWinsResolver implements network.ConflictResolver<VoxelNetworkCommand> {
  resolve({ existing }: network.ConflictContext<VoxelNetworkCommand>): "accept" | "reject" {
    // Accept only if no prior command exists at this position
    return existing ? "reject" : "accept";
  }
}

const server = new VoxelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

> **Note:** Conflict resolution only applies to per-position voxel operations (`"voxel-set"`,
> `"voxel-removed"`). Structural layer operations (`"added"`, `"removed"`, `"reordered"`, etc.)
> are always accepted.

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
