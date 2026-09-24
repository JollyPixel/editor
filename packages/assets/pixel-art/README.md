<h1 align="center">
  asset.pixel-art
</h1>

<p align="center">
  Pixel-art assets
</p>

## 💃 Getting Started

This workspace-private package stores `.pixelart` documents. Add `"@jolly-pixel/asset.pixel-art": "workspace:*"` to another workspace's dependencies.

## 👀 Usage example

### Register the kind

```ts
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";

using eventStore = await EventStore.persistence.sqlite(
  "./assets/.jollypixel/events.db"
);
await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [pixelArtAssetKind({ defaultSize: { x: 32, y: 32 } })]
});
```

The handler claims `.pixelart` files. `defaultSize` is used when a state is created or cleared; it defaults to 32 by 32. The renderer package owns the document codec. Use `MemoryAssetSource` and an in-memory event store for an ephemeral workspace.

### Connect a document

Create the synced document before joining the room so it receives the first snapshot.

```ts
import { Client } from "@jolly-pixel/network/client";
import {
  SyncedPixelDocument,
  pixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

const client = new Client();
const room = pixelArtRoom(client, assetId);
const synced = new SyncedPixelDocument(room);

room.join();
await synced.ready;

// Pass synced.document to PixelArtCanvas or another document consumer.
// On teardown: synced.dispose(); room.leave(); client.destroy();
```

`PixelCollaboration` adds cursors and in-progress previews to a `PixelArtCanvas` built on that document. See the [network API](./docs/network.md) for its constructor and lifecycle.

## 📚 API

- `@jolly-pixel/asset.pixel-art` exports `pixelArtAssetKind`, `PixelArtState`, the `PIXEL_ART_ASSET` descriptor, the kind and event constants for server registration, and the document builders `createPixelArtDocument(size)` and `pixelArtDocumentFromPng(png)` for seeds and fixtures.
- `@jolly-pixel/asset.pixel-art/network/client.ts` exports `SyncedPixelDocument`, `PixelSyncClient`, `pixelArtRoom`, `createPixelArtAsset`, `PixelCollaboration`, presence helpers, and wire types.
- `@jolly-pixel/asset.pixel-art/network/server.ts` exports `PixelCommandArbiter`, `applyCommandToBuffer`, and the command and snapshot schemas.

The package root imports server dependencies. Browser code should use the client entry point. The [network API](./docs/network.md) covers commands, snapshots, notices, and presence helpers. [Architecture](./ARCHITECTURE.md) covers replay and conflict handling. The pixel document format and codec are documented by [pixel-draw.renderer](../../pixel-draw-renderer/docs/serialization/index.md).

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.pixel-art test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
