<h1 align="center">
  asset.voxel-model
</h1>

<p align="center">
  Voxel-model assets
</p>

## 💃 Getting Started

This workspace-private package stores `.voxelmodel.json` model trees: blocks and folders, a material library and links to animation sets. Add `"@jolly-pixel/asset.voxel-model": "workspace:*"` to another workspace's dependencies.

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
import { createAssetWorkspacePlugin } from "@jolly-pixel/asset-server/node";
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

A model references one pixel-art texture, which only stores pixels: each block owns its UV layout. `createVoxelModelDocument({ texture, blocks? })` creates a model with one root block named `Block`, or one root block per name in `blocks`; `blocks: []` creates an empty tree. A model created without content comes with a pixel-art texture of the same name beside it. Every linked animation set is a catalog dependency of the model. Pass `snapshot` to `voxelModelAssetKind()` to change when snapshots are written.

`decodeVoxelModelDocument()` throws `InvalidAssetDocumentError` from `@jolly-pixel/asset-server` when the bytes are not JSON or do not match `voxelModelDocumentSchema`. Loading the tree then throws `InvalidModelTreeError` when an ID repeats, a parent or material is missing, or an entry is its own ancestor, and keeps the previous tree.

### Connect a model

```ts
import { assetRoomName } from "@jolly-pixel/asset";
import { Client } from "@jolly-pixel/network/client";
import {
  SyncedModelDocument,
  type VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";

const client = new Client();
const room: VoxelModelRoom = client.room(assetRoomName("voxelmodel", assetId));
const synced = new SyncedModelDocument(room);

room.join();
await synced.ready;
const blockId = synced.document.addBlock({ name: "Body" });

// On teardown: synced.dispose(); room.leave(); client.destroy();
```

The first snapshot loads the document. Local edits go to the room and stay pending until the server acknowledges them; peer commands are applied with a remote origin. A rejected edit returns `null` from `addBlock` or `addFolder`, and `false` from the other edit methods.

## 📚 API

- `@jolly-pixel/asset.voxel-model` exports `voxelModelAssetKind`, `VoxelModelState`, the document codec and `voxelModelDocumentSchema`, the `VOXEL_MODEL_ASSET` descriptor, `ASSET_KINDS` (the [kind package](../../asset-server/docs/AssetKinds.md#kind-packages), taking `{ snapshot? }` options), the kind and event constants, and everything the client entry point exports from the model.
- `@jolly-pixel/asset.voxel-model/client` exports the [model document](./docs/model.md) (`ModelDocument`, `ModelTree`, `BlockTransform`, `BlockUvLayouts`), the [material library](./docs/materials.md) (`MaterialSurface`, the material clipboard codec), the [animation bindings](./docs/animation.md) (`TrackBinding`, `blockPathOf`), the [undo keys](./docs/history.md) (`modelHistoryKeys`), `SyncedModelDocument`, `voxelModelWriteKeys`, `voxelModelDocumentKind`, and the wire types.
- `@jolly-pixel/asset.voxel-model/server` exports `VoxelModelCommandArbiter`, the conflict keys, and the command and snapshot schemas.

The package root imports server dependencies. Browser code should use the client entry point. See the [network API](./docs/network.md) for commands and sync behavior and [architecture](./ARCHITECTURE.md) for tree rules and conflict keys.

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.voxel-model test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
