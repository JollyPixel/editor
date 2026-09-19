# Set up network synchronization

One room represents one `.pixelart` asset. `pixelArtRoom(client, assetId)` opens it.

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
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: import.meta.dirname,
      source: new MemoryAssetSource(),
      eventStore: EventStore.persistence.memory(),
      handlers: [
        pixelArtAssetKind({ defaultSize: { x: 80, y: 80 } })
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

Create the room and the synced document before joining, so the first snapshot has a target. A canvas built on the document shows it, and `PixelCollaboration` adds presence:

```ts
import { Client } from "@jolly-pixel/network/client";
import { colorFromKey } from "@jolly-pixel/color";
import { AssetCatalog } from "@jolly-pixel/asset";
import { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelCollaboration,
  SyncedPixelDocument,
  pixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

const catalog = await AssetCatalog.fetch();
const record = [...catalog].find(
  (entry) => entry.source === "main.pixelart"
)!;

const networkClient = new Client({
  profile: { username: "alice" }
});
const room = pixelArtRoom(networkClient, record.id.value);

const synced = new SyncedPixelDocument(room, {
  history: { enabled: true }
});
const canvas = new PixelArtCanvas(parent, { document: synced.model });
const collaboration = new PixelCollaboration({
  room,
  canvas,
  label: (_clientId, profile) => String(profile.username),
  color: (clientId) => colorFromKey(clientId)
});
synced.sync.on("notice", (notice) => {
  console.warn(`asset room: ${notice.type}`);
});

room.join();
await synced.ready;
```

An `@jolly-pixel/editor.host` session does the same through `pixelArtModelKind`: it leases the asset, joins the room and resolves once the document is ready.

To create a new asset, pass a `CatalogClient` and a `PixelArtDocumentData` to `createPixelArtAsset(catalog, path, document)`. It encodes the document, creates it with the pixel-art kind, suffixes the path on conflict and resolves the new asset id.

`Client` uses `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws-sync` by default. Pass `url` when the server uses another origin or WebSocket path.

## Startup and snapshots

The server sends a snapshot as soon as the room admits the client. Construct `SyncedPixelDocument` (or a bare `PixelSyncClient` on a document) and register listeners before `room.join()`.

`synced.ready` resolves once the first snapshot has been applied to the document. The sync client's `"ready"` event fires once; `"snapshot"` fires for every snapshot.

Snapshots replace texture pixels and UV regions, then clear local history. Remote resize and texture-replacement commands also clear local history.

## Committed edits

Local document mutations flow through `document.onBufferUpdated`. `PixelSyncClient` adds `clientId`, `seq` and `timestamp`, then sends the command to the room. The asset room replaces the claimed `clientId` with the connection ID, validates the command, resolves conflicts, appends the accepted command to the event log and broadcasts it. When the append fails, the author receives a `"rejected"` notice. `pixelArtAssetKind` folds the appended event into the buffer.

Commands echoed to their sender are ignored. Remote commands use `document.applyRemoteCommand()`, which does not emit `onBufferUpdated`, so they are not sent again.

Undo and redo keep the original edit timestamp. The default conflict resolver always accepts same-client replay order; commands from different clients use timestamp and then `clientId` as a tie-breaker. Client clocks therefore affect conflict results.

## Rights

Asset rooms are named after their kind, `"pixelart"`, and expose each command action through the inbound protocol, so they can use an `@jolly-pixel/network` rights table:

```ts
createAssetWorkspacePlugin({
  root: import.meta.dirname,
  handlers: [pixelArtAssetKind()],
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

Destroy the collaboration before destroying the canvas. Room and socket lifetime remain under application control:

```ts
collaboration.destroy();
synced.dispose();
room.leave();
networkClient.destroy();
canvas.destroy();
```

`collaboration.destroy()` restores the canvas hooks and removes its room listeners; `synced.dispose()` does the same for the document hook. It does not leave the room or close the shared socket.
