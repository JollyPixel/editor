<h1 align="center">
  asset.voxel-map
</h1>

<p align="center">
  Persistence, Tiled catalog loading, and real-time collaboration for voxel maps
</p>

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

`VoxelRenderer` wraps `VoxelEngine` in an actor component and drives its
lifecycle:

```ts
import {
  VoxelRenderer
} from "@jolly-pixel/asset.voxel-map/renderers/index.ts";

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  focus: cameraActor.object3D,
  tilesets,
  blocks
});
```

Synchronize the engine with a room:

```ts
import { Client } from "@jolly-pixel/network/client";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";

const room = new Client().room<
  VoxelNetworkCommand,
  VoxelServerMessage
>("voxel-map:main");
const sync = new VoxelSyncClient({ room });

sync.attach(renderer.engine);
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

For an in-memory world, use `VoxelSyncServer` from the server entry point. Both
servers speak the same protocol, so `VoxelSyncClient` connects to either.

## 📚 API

- [Voxel-map asset APIs](./docs/api/voxel-map-assets.md)
- [`VoxelRenderer`](./docs/api/renderers/VoxelRenderer.md)
- [`TiledMapAssetLoader`](./docs/api/TiledMapAssetLoader.md)
- Network
  - [`VoxelSyncClient`](./docs/api/network/VoxelSyncClient.md)
  - [`VoxelSyncServer`](./docs/api/network/VoxelSyncServer.md)
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
$ npm run test -w @jolly-pixel/asset.voxel-map
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
