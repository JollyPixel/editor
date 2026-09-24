<h1 align="center">
  asset.voxel-model
</h1>

<p align="center">
  Voxel-model assets
</p>

## 💃 Getting Started

This workspace-private package stores `.voxelmodel.json` model trees. Add `"@jolly-pixel/asset.voxel-model": "workspace:*"` to another workspace's dependencies.

## 👀 Usage example

### Register the kind

```ts
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";
import { createAssetWorkspacePlugin } from "@jolly-pixel/asset-server/plugins/vite.ts";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: import.meta.dirname,
      handlers: [voxelModelAssetKind()],
      seed: {
        "models/model.voxelmodel.json": () => encodeVoxelModelDocument(
          createVoxelModelDocument()
        )
      }
    })
  ]
});
```

`createVoxelModelDocument({ texture?, blocks? })` creates a version 2 document. It starts with one root block named `Block` unless `blocks` supplies root names; `blocks: []` creates an empty tree. `decodeVoxelModelDocument()` throws `InvalidVoxelModelDocumentError` for malformed bytes.
Set `texture` to a pixel-art asset reference when the model uses one.

### Connect a model

```ts
import { assetRoomName } from "@jolly-pixel/asset";
import { Client } from "@jolly-pixel/network/client";
import {
  SyncedModelDocument,
  type VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

const client = new Client();
const room: VoxelModelRoom = client.room(assetRoomName("voxelmodel", assetId));
const synced = new SyncedModelDocument(room);

room.join();
await synced.ready;
const blockId = synced.document.addBlock({ name: "Body" });

// On teardown: synced.dispose(); room.leave(); client.destroy();
```

`ModelDocument` exposes `addBlock`, `addFolder`, `remove`, `rename`, `move`, and `transform`. Local changes are sent to the room by `ModelSyncClient`; snapshots replace the local tree. A rejected edit returns `null` from `addBlock` or `addFolder`, or `false` from the other edit methods.

## 📚 API

- `@jolly-pixel/asset.voxel-model` exports `voxelModelAssetKind`, the document codec, `VoxelModelState`, `ModelTree`, `ModelDocument`, the `VOXEL_MODEL_ASSET` descriptor, and the kind and event constants.
- `@jolly-pixel/asset.voxel-model/network/client.ts` exports `ModelSyncClient`, `SyncedModelDocument`, `voxelModelDocumentKind`, and model types.
- `@jolly-pixel/asset.voxel-model/network/server.ts` exports `VoxelModelCommandArbiter` and the command and snapshot schemas.

The package root imports server dependencies. Browser code should use the client entry point. See the [network API](./docs/network.md) for command shapes and sync behavior, and [architecture](./ARCHITECTURE.md) for tree and arbitration rules.

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.voxel-model test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
