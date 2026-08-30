# Network Sync Layer

The network sync layer adds **server-authoritative multiplayer** on top of `VoxelEngine`, built directly on `@jolly-pixel/network`'s primitives (`network.Server` / `network.Extension` / `network.Client` / `network.Room`). Multiple clients share the same voxel world in real time: `VoxelSyncClient` extends `network.SyncAdapter` to wire a `VoxelEngine` instance (standalone or via `vr.engine`) to a `network.Room`, and `VoxelSyncServer` is a `network.Extension` that owns the authoritative `VoxelWorld`.

This mirrors `@jolly-pixel/pixel-draw.renderer`'s network layer
(`PixelSyncClient`/`PixelSyncServer`). Both packages use the same wire discipline
and dev-server wiring pattern.

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
4. `network.Server` routes it to the registered `VoxelSyncServer` instance for that room. The extension checks for command marker fields, runs conflict resolution, applies the command to its authoritative `VoxelWorld`, and broadcasts it to every client joined to that room.
5. Each client's room handle dispatches a `"message"` event with `{ type: "command", data: cmd }`, which `VoxelSyncClient` routes to `engine.applyRemoteCommand(cmd)` (skipping its own echoed commands by `clientId`).
6. `applyRemoteCommand` sets an internal flag so that the resulting hook event is
   **not** re-emitted, preventing an echo loop.

## Client setup

```ts
import * as network from "@jolly-pixel/network";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/index.ts";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({ url: `${wsProtocol}//${location.host}/ws-sync` });
const room = client.room<VoxelNetworkCommand, VoxelServerMessage>("voxel-map:world");

const syncClient = new VoxelSyncClient({ room });
syncClient.attach(vr.engine); // or a standalone, headless VoxelEngine
```

`attach()` **chains** onto any existing `engine.onLayerUpdated` handler. A handler
set during `VoxelEngine` or `VoxelRenderer` construction keeps firing. `detach()`
restores the handler that was present before `attach()`.

### Lifecycle

```ts
// When the sync client is no longer needed:
syncClient.destroy(); // detach() + removes its "message" listener + room.leave()
```

## Server setup — Vite dev server

`VoxelSyncServer` is a `network.Extension`. Register it on a `network.Server` through
the `createWebSocketNetworkPlugin` Vite plugin from `@jolly-pixel/network`. This is
the same setup used by `pixel-draw-renderer`. One `vite dev` process then serves the
static app and the WebSocket sync endpoint:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { VoxelSyncServer } from "@jolly-pixel/voxel.renderer/network/index.ts";

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

Register one `VoxelSyncServer` per world under separate room IDs. The same
`network.Server` and WebSocket can also host a `PixelSyncServer` for texture sync
because both use the `network.Extension` base.

> **Pre-seed the server's world to match the client's initial state.** A client may
> create a default layer before `VoxelSyncClient` attaches. That layer is never sent
> to the server. If the server starts with an empty `VoxelWorld`, its first snapshot
> has no layers, and `engine.load()` clears the client's local default layer. Pass a
> pre-populated `world` with the same bootstrapped layer names:
> ```ts
> import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
> import { VoxelSyncServer } from "@jolly-pixel/voxel.renderer/network/index.ts";
>
> const world = new VoxelWorld(16);
> world.addLayer("Ground");
> new VoxelSyncServer({ id: "voxel-map:world", world });
> ```
>
> Mutation commands that fail inside `applyCommandToWorld()` are caught, logged, and
> dropped. `isVoxelNetworkCommand()` is only a shallow marker check: it verifies that
> the payload is an object with `action` and `clientId` fields, so validate untrusted
> wire data before it reaches this extension. A `world-replace` payload is the one
> exception: `deserializeVoxelWorld()` validates it, and a rejected document is
> logged and dropped like a failed mutation command.

### API

| Method | Description |
|--------|-------------|
| `onClientConnect(client)` | Sends the current snapshot to a newly joined client (called by `network.Server`). |
| `onClientDisconnect(clientId)` | No-op. `network.Server` owns membership bookkeeping. |
| `onMessage(clientId, payload, context)` | Applies the shallow command-marker check, then routes the payload to `receive()`. |
| `getEventName(payload)` | Returns the command's `action`, or `"unknown"` for a non-command payload. `network.ServerRoom` uses it for rights lookup (see [Rights (RBAC)](#rights-rbac)). |
| `name` | Always `"voxel.renderer"`, shared by every instance regardless of `id`. Rights tables use it as their namespace, for example `"voxel.renderer.*"`. |
| `events` | The `VoxelLayerHookAction` vocabulary (`"voxel-set"`, `"object-added"`, ...). It does not include the administrative `"world-replace"` action. |
| `receive(cmd, context)` | Applies and broadcasts an already-typed command via `context.room.broadcast()` (useful in tests). |
| `snapshot()` | Returns the current layer/object snapshot as `VoxelWorldJSON`; `tilesets` is empty and block definitions are omitted. |
| `world` | The authoritative `VoxelWorld` instance. |

`network.ServerRoom` passes `context: network.RoomContext` for each call. The
extension does not store it, so `VoxelSyncServer` can broadcast only while handling
a client event. Use `network.Server.broadcast(roomId, payload)` for a server-driven
push such as a timer or admin action.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | `"voxel-map"` | `network.Extension` id this server is registered under. |
| `world` | `VoxelWorld` | new world | Existing world to use as authoritative state. |
| `chunkSize` | `number` | `16` | Chunk size when creating a new world. |
| `conflictResolver` | `network.ConflictResolver<VoxelNetworkCommand>` | `network.LastWriteWinsResolver` | Custom conflict strategy. |

## Rights (RBAC)

`VoxelSyncServer` exposes its type identity through `name` (always
`"voxel.renderer"`) and its action vocabulary through `events` and
`getEventName()`. Configure roles and policy once on `network.Server`, typically in
`vite.config.ts` beside `createWebSocketNetworkPlugin`. Rights are keyed by `name`,
so one rule set covers every voxel world registered on that server:

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

A client with no `role` in its join `identity`, or a role missing from the table,
receives full write access under `@jolly-pixel/network`'s unrestricted default (see
[Rights](../../network/docs/Rights.md)). Role assignment here is **not authenticated**:
`identity.role` is whatever the client sent at `room.join()`. Resolve the role from a
trusted session or authentication layer before constructing the client identity when
the room needs access control.

## VoxelNetworkCommand — wire format

A `VoxelNetworkCommand` is either a layer hook event or a full-world replacement,
extended with `@jolly-pixel/network`'s routing header:

```ts
interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

type VoxelNetworkCommand =
  (VoxelLayerHookEvent | VoxelWorldReplaceCommand) &
  network.NetworkCommandHeader;
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

Both `NetworkCommandHeader` and `NetworkServerMessage` live in
`@jolly-pixel/network`. `pixel-draw-renderer` uses the same definitions for
`PixelNetworkCommand` and `PixelServerMessage`; see
[`SyncAdapter`](../../network/docs/sync/SyncAdapter.md).

### Replacing the world

```ts
syncClient.replaceWorld(vr.engine.save());
```

`replaceWorld(data)` sends a stamped `"world-replace"` command. The server replaces
its voxel and object layers, then broadcasts a snapshot. This action bypasses conflict
arbitration. Server snapshots contain layer and object-layer state with an empty
`tilesets` list; each client must already have matching tilesets and block definitions.

## Conflict resolution

### Default: network.LastWriteWinsResolver

The default resolver uses **timestamp** to determine which command wins at a given voxel
position. On a tie, the lexicographically greater `clientId` wins (deterministic without
coordination). Commands from the *same* `clientId` as the last accepted one always win,
regardless of timestamp ordering. This keeps replayed operations, such as undo and
redo commands, from being rejected as stale by their own historical timestamp. See
[Conflicts](../../network/docs/sync/Conflicts.md) for the full rationale. The resolver
is shared with `pixel-draw-renderer`.

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
import {
  VoxelSyncServer,
  type VoxelNetworkCommand
} from "@jolly-pixel/voxel.renderer/network/index.ts";

class FirstWriteWinsResolver implements network.ConflictResolver<VoxelNetworkCommand> {
  resolve({ existing }: network.ConflictContext<VoxelNetworkCommand>): "accept" | "reject" {
    // Accept only if no prior command exists at this position
    return existing ? "reject" : "accept";
  }
}

const server = new VoxelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

> **Note:** Conflict resolution only applies to per-position voxel operations
> (`"voxel-set"`, `"voxel-removed"`). Structural layer operations are always
> accepted, and `"world-replace"` bypasses arbitration.

## VoxelCommandApplier — headless usage

`applyCommandToWorld` lets you replay hook events against a bare `VoxelWorld` without a
renderer. Useful for server-side logic, unit tests, or offline editing tools.

```ts
import { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import {
  applyCommandToWorld
} from "@jolly-pixel/voxel.renderer/network/index.ts";

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
