# Synchronizing a world

`VoxelSyncClient` connects a `VoxelEngine` to a network room.
`voxelMapAssetHandler` owns the authoritative headless world for that room.

## Connect a client

```ts
import * as network from "@jolly-pixel/network";
import { assetRoomName } from "@jolly-pixel/asset";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({
  url: `${protocol}//${location.host}/ws-sync`
});
const room = client.room<
  VoxelNetworkCommand,
  VoxelServerMessage
>(assetRoomName("voxelmap", assetId));

const sync = new VoxelSyncClient({ room, engine });
room.join();
```

The constructor subscribes to the engine's `"command"` event and sends local
commands; other listeners keep working. Call `destroy()` when the client is no
longer needed; it unsubscribes, removes the message listener, and leaves the
room.

## Register the server

Serve the asset kind through the asset workspace Vite plugin. Every
`.voxelmap.json` document gets its own room, opened on first join:

```ts
import { defineConfig } from "vite";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import {
  voxelMapAssetHandler,
  VoxelMapState
} from "@jolly-pixel/asset.voxel-map";
import { encodeVoxelDocument } from "@jolly-pixel/voxel.renderer";

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: "./assets",
      handlers: [
        voxelMapAssetHandler({ chunkSize: 16 })
      ],
      seed: {
        "maps/world.voxelmap.json": () => {
          const state = new VoxelMapState(16);
          state.world.addLayer("Ground");

          return encodeVoxelDocument(state.toJSON());
        }
      }
    })
  ]
});
```

A layer created before synchronization is not sent as a command, so seed the
document with the layers the client expects. Clients resolve the room name
from the catalog with `assetRoomName(record.kind, record.id.value)`.

## Replace the world

```ts
sync.replaceWorld(engine.save());
```

The server replaces its voxel and object layers, adopts the document's block
table when it carries one, then broadcasts a fresh snapshot.

## Publish a block definition

```ts
engine.defineBlock(definition);
```

`defineBlock()`, `defineBlocks()`, `removeBlock()` and `moveBlock()` emit a
local command, so the edit publishes itself and a peer's arrives on the same
`"command"` event with a `"remote"` origin. Write straight to `engine.blockRegistry` only for definitions
each client derives on its own, such as tileset defaults, which must not be
published.

## Access control

Rights use the asset kind `"voxelmap"` as extension name and action names such
as `"voxel-set"` or `"block-defined"`. Pass them as `rights` to the workspace
plugin. The network package allows actions that do not have a matching policy
entry, so list every mutation that a restricted role must not perform or use a
trailing `"voxelmap.*"` rule.

Client-supplied role values are not authentication. Resolve roles from a trusted
session before constructing the room identity when access control matters.

See [network synchronization](./network-synchronization.md) for the
message flow and conflict rules. API details are available for
[`VoxelSyncClient`](../api/network/VoxelSyncClient.md) and the
[voxel-map asset APIs](../api/voxel-map-assets.md).
