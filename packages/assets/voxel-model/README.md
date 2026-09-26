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
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";
import { createAssetWorkspacePlugin } from "@jolly-pixel/asset-server/plugins/vite.ts";
import { defineConfig } from "vite";

const texture = {
  id: crypto.randomUUID(),
  kind: PIXEL_ART_KIND
};

export default defineConfig({
  plugins: [
    createAssetWorkspacePlugin({
      root: import.meta.dirname,
      handlers: [
        voxelModelAssetKind(),
        pixelArtAssetKind()
      ],
      seed: {
        "textures/model.pixelart": texture,
        "models/model.voxelmodel.json": () => encodeVoxelModelDocument(
          createVoxelModelDocument({ texture })
        )
      }
    })
  ]
});
```

`createVoxelModelDocument({ texture, blocks? })` creates a version 2 document. `texture` is a required pixel-art asset reference. A block's `position` is its pivot point, relative to its parent's pivot, and `pivotOffset` is where that pivot sits on the box, from the box center along the box's own axes. A block's `scale` applies around its pivot and carries its child blocks. Children never skew: each child takes its parent's scale on the same axis, whatever its rotation. It starts with one root block named `Block` unless `blocks` supplies root names; `blocks: []` creates an empty tree. Each block carries a UV layout, `createBlockUv()` by default. `decodeVoxelModelDocument()` throws `InvalidAssetDocumentError` from `@jolly-pixel/asset-server/kinds` when the bytes are not JSON or do not match `voxelModelDocumentSchema`: version 2, every node shaped as in a snapshot, and `texture` an asset reference. Loading the document then throws `InvalidModelTreeError` when an id repeats, a parent is missing or a node is its own ancestor, and keeps the previous tree.

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

`ModelDocument` exposes `addBlock`, `addFolder`, `remove`, `rename`, `move`, `transform`, and `setUv`. Each block stores its own UV layout; the pixel-art texture only stores pixels. Local changes are sent to the room by `ModelSyncClient`; snapshots replace the local tree. A rejected edit returns `null` from `addBlock` or `addFolder`, or `false` from the other edit methods.

## 📚 API

- `@jolly-pixel/asset.voxel-model` exports `voxelModelAssetKind`, the document codec and `voxelModelDocumentSchema`, `VoxelModelState`, `ModelTree`, `ModelDocument`, the `VOXEL_MODEL_ASSET` descriptor, and the kind and event constants.
- `@jolly-pixel/asset.voxel-model/network/client.ts` exports `ModelSyncClient`, `SyncedModelDocument`, `voxelModelDocumentKind`, and model types.
- `@jolly-pixel/asset.voxel-model/network/server.ts` exports `VoxelModelCommandArbiter` and the command and snapshot schemas.

The package root imports server dependencies. Browser code should use the client entry point. See the [network API](./docs/network.md) for command shapes and sync behavior, and [architecture](./ARCHITECTURE.md) for tree and arbitration rules.

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.voxel-model test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
