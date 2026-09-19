<h1 align="center">
  asset.voxel-map
</h1>

## 💃 Getting Started

This workspace-private package is never published. Add it as a dependency of
another workspace:

```json
{
  "dependencies": {
    "@jolly-pixel/asset.voxel-map": "1.0.0"
  }
}
```

## 👀 Usage example

Synchronize a `VoxelEngine` with a room:

```ts
import { Client } from "@jolly-pixel/network/client";
import { assetRoomName } from "@jolly-pixel/asset";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";

const room = new Client().room<
  VoxelNetworkCommand,
  VoxelServerMessage
>(assetRoomName("voxelmap", assetId));
const sync = new VoxelSyncClient({
  room,
  engine
});

room.join();
```

On the server, register the asset kind to persist `.voxelmap.json` files:

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import { voxelMapAssetHandler } from "@jolly-pixel/asset.voxel-map";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [voxelMapAssetHandler({ chunkSize: 16 })]
});
```

For an in-memory world, pass a `MemoryAssetSource` and a `persistence.memory()`
event store instead.

## 📚 API

- [Voxel-map asset APIs](./docs/api/voxel-map-assets.md)
- Network
  - [`VoxelSyncClient`](./docs/api/network/VoxelSyncClient.md)
  - [`VoxelCommandArbiter`](./docs/api/network/VoxelCommandArbiter.md)
  - [Network protocol](./docs/api/network/protocol.md)

### Guides

- [Persisting a voxel map](./docs/guides/persisting-a-voxel-map.md)
- [Synchronizing a world](./docs/guides/synchronizing-a-world.md)
- [Network synchronization](./docs/guides/network-synchronization.md)

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Run these commands from the monorepo root:

```bash
$ pnpm --filter @jolly-pixel/asset.voxel-map test
$ pnpm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
