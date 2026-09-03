# Synchronizing a world

`VoxelSyncClient` connects a `VoxelEngine` to a network room.
`VoxelSyncServer` owns the authoritative headless world for that room.

## Connect a client

```ts
import * as network from "@jolly-pixel/network";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/index.ts";

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({
  url: `${protocol}//${location.host}/ws-sync`
});
const room = client.room<
  VoxelNetworkCommand,
  VoxelServerMessage
>("voxel-map:world");

const sync = new VoxelSyncClient({ room });
sync.attach(renderer.engine);
```

`attach()` preserves the engine's existing `onLayerUpdated` listener and chains
network sending after it. `detach()` restores that listener. Call `destroy()`
when the client is no longer needed; it detaches, removes the message listener,
and leaves the room.

## Register the server

Register one server extension per world through the network Vite plugin:

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import {
  VoxelSyncServer
} from "@jolly-pixel/voxel.renderer/network/index.ts";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new VoxelSyncServer({
          id: "voxel-map:world"
        })
      ]
    })
  ]
});
```

The server's initial layers must match the client bootstrap state. A layer
created before synchronization is not sent as a command. Seed the authoritative
world when the client expects an initial layer:

```ts
const world = new VoxelWorld(16);
world.addLayer("Ground");

const server = new VoxelSyncServer({
  id: "voxel-map:world",
  world
});
```

## Replace the world

```ts
sync.replaceWorld(renderer.engine.save());
```

The server replaces its voxel and object layers, adopts the document's block
table when it carries one, then broadcasts a fresh snapshot. Server snapshots
use an empty tileset list, so every client must already have matching textures.

## Publish a block definition

```ts
renderer.engine.defineBlock(definition);
```

`defineBlock()`, `defineBlocks()`, and `removeBlock()` emit `onBlockUpdated`,
which `attach()` chains, so the edit publishes itself and a peer's arrives on
the same hook. Write straight to `engine.blockRegistry` only for definitions
each client derives on its own, such as tileset defaults, which must not be
published.

## Access control

Rights use the extension name `"voxel.renderer"` and action names such as
`"voxel-set"` or `"block-defined"`. Configure them on `network.Server` beside
the Vite plugin. The network package allows actions that do not have a matching policy entry, so list
every mutation that a restricted role must not perform or use a trailing
`"voxel.renderer.*"` rule.

Client-supplied role values are not authentication. Resolve roles from a trusted
session before constructing the room identity when access control matters.

See [network synchronization](../concepts/network-synchronization.md) for the
message flow and conflict rules. API details are available for
[`VoxelSyncClient`](../api/network/VoxelSyncClient.md) and
[`VoxelSyncServer`](../api/network/VoxelSyncServer.md).
