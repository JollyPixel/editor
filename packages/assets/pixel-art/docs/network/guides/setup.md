# Set up network synchronization

One room represents one `.pixelart` asset. Its name is `assetRoomName("pixelart", assetId)`.

## Server

Serve the asset kind through the asset workspace Vite plugin, on the default `/ws-sync` WebSocket path. This example keeps everything in memory:

```ts
import { defineConfig } from "vite";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";
import {
  createAssetWorkspacePlugin
} from "@jolly-pixel/asset-server/plugins/vite.ts";
import {
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import { pixelArtAssetHandler } from "@jolly-pixel/asset.pixel-art";

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: import.meta.dirname,
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory(),
      handlers: [
        pixelArtAssetHandler({ defaultSize: { x: 80, y: 80 } })
      ],
      seed: {
        "main.pixelart": () => encodePixelArtDocument(
          serializePixelBuffer(new PixelBuffer({ size: { x: 80, y: 80 } }))
        )
      }
    })
  ]
});
```

Drop `source` and `eventStore` to persist documents under `root`. Each seeded or discovered document gets its own room, opened on first join. Its buffer becomes the snapshot sent to the first client and every late joiner.

## Browser client

Create the room and sync controller before joining. Attach the canvas before `room.join()` so the first snapshot has a target:

```ts
import { Client } from "@jolly-pixel/network/client";
import {
  AssetCatalog,
  assetRoomName
} from "@jolly-pixel/asset";
import {
  PixelSyncClient,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

const catalog = await AssetCatalog.fetch();
const record = [...catalog].find(
  (entry) => entry.source === "main.pixelart"
)!;

const networkClient = new Client({
  identity: { username: "alice" }
});
const room = networkClient.room<
  PixelNetworkCommand,
  PixelServerMessage
>(assetRoomName(record.kind, record.id.value));

const sync = new PixelSyncClient({ room });
sync.on("ready", () => {
  console.log("Initial snapshot received");
});
sync.attach(canvas);

room.join();
```

`Client` uses `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws-sync` by default. Pass `url` when the server uses another origin or WebSocket path.

## Startup and snapshots

The server sends a snapshot as soon as the room admits the client. `PixelSyncClient` applies it only when a canvas is attached. Follow this order:

1. Create the room.
2. Construct `PixelSyncClient` and register any `"ready"` or `"snapshot"` listeners.
3. Attach the canvas.
4. Call `room.join()`.

Optional presence helpers can attach after `"ready"`, when `room.peers` contains the initial peer snapshot. See [presence previews](./presence.md).

`sync.ready` becomes `true` when the first snapshot message arrives. With the ordering above, that snapshot has also been applied to the canvas. The `"ready"` event fires once; `"snapshot"` fires for every snapshot.

Snapshots replace texture pixels and UV regions, then clear local history. Remote resize and texture-replacement commands also clear local history.

## Committed edits

Local canvas mutations flow through `canvas.onBufferUpdated`. `PixelSyncClient` adds `clientId`, `seq` and `timestamp`, then sends the command to the room. The asset room validates the command, replaces its claimed `clientId` with the connection ID, resolves conflicts, appends the accepted command to the event log and broadcasts it. `pixelArtAssetHandler` folds the appended event into the buffer.

Commands echoed to their sender are ignored. Remote commands use `canvas.applyRemoteCommand()`, which does not emit `onBufferUpdated`, so they are not sent again.

Undo and redo keep the original edit timestamp. The default conflict resolver always accepts same-client replay order; commands from different clients use timestamp and then `clientId` as a tie-breaker. Client clocks therefore affect conflict results.

## Rights

Asset rooms are named after their kind, `"pixelart"`, and expose each command action through the inbound protocol, so they can use an `@jolly-pixel/network` rights table:

```ts
createAssetWorkspacePlugin({
  root: import.meta.dirname,
  handlers: [pixelArtAssetHandler()],
  rights: {
    viewer: {
      "pixelart.$join": "write",
      "pixelart.$presence": "write",
      "pixelart.*": "read"
    },
    editor: {
      "pixelart.*": "write"
    }
  }
});
```

The network package reads the role from `identity.role`. Client-supplied identity is metadata, not authentication. Resolve the authenticated role in your server integration before relying on these rules. See [`@jolly-pixel/network` rights](../../../../../network/docs/Rights.md).

## Teardown

Destroy sync helpers before destroying the canvas. Room and socket lifetime remain under application control:

```ts
sync.destroy();
room.leave();
networkClient.destroy();
canvas.destroy();
```

`sync.destroy()` detaches the canvas and removes the controller's room listener. It does not leave the room or close the shared socket.
