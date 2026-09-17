<h1 align="center">
  asset.pixel-art
</h1>

<p align="center">
  Persistence and real-time collaboration for pixel-art documents
</p>

## 💃 Getting Started

This workspace-private package is never published. Add it as a dependency of
another workspace:

```json
{
  "dependencies": {
    "@jolly-pixel/asset.pixel-art": "1.0.0"
  }
}
```

## 👀 Usage example

Attach a canvas to a room in the browser:

```ts
import { Client } from "@jolly-pixel/network/client";
import { colorFromKey } from "@jolly-pixel/color";
import { assetRoomName } from "@jolly-pixel/asset";
import {
  PixelCollaboration,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";

const room = new Client().room<
  PixelNetworkCommand,
  PixelServerMessage
>(assetRoomName("pixelart", assetId));
const collaboration = new PixelCollaboration({
  room,
  canvas,
  label: (_clientId, profile) => String(profile.username),
  color: (clientId) => colorFromKey(clientId)
});

room.join();
```

On the server, register the asset kind with `@jolly-pixel/asset-server`:

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import { pixelArtAssetHandler } from "@jolly-pixel/asset.pixel-art";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [pixelArtAssetHandler({ defaultSize: { x: 32, y: 32 } })]
});
```

For an in-memory canvas, pass a `MemoryAssetSource` and a
`persistence.memory()` event store instead.

## 📚 API

- [Pixel-art asset kind](./docs/asset/index.md)
- [Network synchronization](./docs/network/index.md)
  - [`PixelSyncClient`](./docs/network/api/PixelSyncClient.md)
  - [Presence sync](./docs/network/api/PresenceSync.md)
  - [`PixelArtCanvas` integration](./docs/network/api/CanvasIntegration.md)

### Guides

- [Set up network synchronization](./docs/network/guides/setup.md)
- [Add presence previews](./docs/network/guides/presence.md)

## 🧪 Benchmarks

The suite measures `applyCommandToBuffer` for strokes and global fills, and
last-write-wins conflict resolution.

```bash
$ pnpm --filter @jolly-pixel/asset.pixel-art bench
```

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Run these commands from the monorepo root:

```bash
$ pnpm --filter @jolly-pixel/asset.pixel-art test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
