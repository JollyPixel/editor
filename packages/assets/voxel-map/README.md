<h1 align="center">
  asset.voxel-map
</h1>

<p align="center">
  Voxel-map and blockset assets
</p>

## 💃 Getting Started

This workspace-private package stores `.voxelmap.json` worlds and the `.blockset.json` blocksets they link. Add `"@jolly-pixel/asset.voxel-map": "workspace:*"` to another workspace's dependencies.

## 👀 Usage example

### Register the kinds

```ts
import {
  blocksetAssetKind,
  voxelMapAssetKind
} from "@jolly-pixel/asset.voxel-map";
import { createAssetBackend } from "@jolly-pixel/asset-server";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import * as EventStore from "@jolly-pixel/event-store";

using eventStore = await EventStore.persistence.sqlite(
  "./assets/.jollypixel/events.db"
);
await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [blocksetAssetKind(), voxelMapAssetKind()]
});
```

A blockset owns its pixels and their normal map settings, tile size, block definitions and material groups. A world links blocksets by asset reference and stores only its layers; every linked blockset is a catalog dependency of the world. The default `chunkSize` is 16. A map saved with another chunk size still loads, and is saved back with the handler's. The map handler waits 5 seconds after edits before writing a snapshot, with a 60-second maximum delay while edits continue. Pass `snapshot` to change this policy on either kind. `blocksetAssetKind({ tileSize, defaultSize })` sets what a blockset created without content holds: 32-pixel tiles on an 8 by 8 tile grid by default. A map created without content comes with a blockset of the same name beside it, created without content and linked as its `default` blockset. A deleted blockset keeps its pixel and tile sizes and loses its pixels, normal map settings, blocks and material groups.

### Connect a world and its blocksets

Construct the sync clients before joining the rooms. `document` is a `VoxelDocument`; draw it with a `VoxelView` when the editor also needs rendering.

```ts
import { assetRoomName } from "@jolly-pixel/asset";
import { Client } from "@jolly-pixel/network/client";
import { VoxelDocument } from "@jolly-pixel/voxel.renderer";
import {
  SyncedBlockset,
  BLOCKSET_KIND,
  VoxelSyncClient,
  type VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

const client = new Client();
const document = new VoxelDocument();
const room: VoxelMapRoom = client.room(assetRoomName("voxelmap", assetId));
const sync = new VoxelSyncClient({ room, document });
room.join();

const blockset = new SyncedBlockset(
  client.room(assetRoomName(BLOCKSET_KIND, blocksetAssetId))
);
blockset.ready.then(() => {
  // blockset.pixels is a PixelDocument, blockset.blockset a BlocksetDocument
});

// On teardown: sync.destroy(); blockset.dispose(); room.leave(); client.destroy();
```

The first snapshot loads each document. Local world commands go to the map room; local pixel edits and block, material group and tile size commands go to the blockset room. Accepted remote commands are applied with a remote origin. `sync.replaceWorld(document.save())` sends a full replacement and produces a new snapshot.

## 📚 API

- `@jolly-pixel/asset.voxel-map` exports `voxelMapAssetKind`, `VoxelMapState`, `blocksetAssetKind`, `BlocksetState`, `blocksetAsset`, the `VOXEL_MAP_ASSET` and `BLOCKSET_ASSET` descriptors, `ASSET_KINDS` (the [kind package](../../asset-server/docs/AssetKinds.md#kind-packages), taking `{ blockset?, voxelmap? }` options), and the kind and event constants of both kinds for server registration and persistence.
- `createBlocksetDocument({ tileSize?, size?, pixels?, blocks?, materialGroups? })` builds a `BlocksetAssetDocument`; `blocksetDocumentFromPng(png, { tileSize?, blockLimit? })` wraps an image with one cube block per tile, up to `blockLimit` (32). `encodeBlocksetDocument`, `decodeBlocksetDocument` and `parseBlocksetDocument` are its codec; a malformed document throws `InvalidAssetDocumentError` from `@jolly-pixel/asset-server`. The decoders are only exported from the package root.
- `createVoxelMapDocument({ chunkSize, blocksets?, layer? })` encodes a map linking the given blocksets, each in the first free slot, with one `layer` (`"Ground"`). Loading a map checks it against `voxelWorldSchema`, blockset links included, before the renderer parses it; a malformed map throws `InvalidAssetDocumentError`.
- `@jolly-pixel/asset.voxel-map/client` exports `VoxelSyncClient`, `SyncedVoxelMap`, the map's [undo history](./docs/history.md) (`VoxelEdits`, `voxelHistoryRegistration`), `voxelMapDocumentKind`, `BlocksetSyncClient`, `SyncedBlockset`, `blocksetDocumentKind`, `blocksetRoom`, `createBlocksetAsset`, the blockset document builders and encoder, wire types, and `blocksetAsset`. It also exports the [block projection](./docs/projection.md): `blockShapeUv`, `uvGeometryForSlot`, `BlockProjection` and `BlocksetIslands`, which builds a blockset's normal map islands from its blocks.
- `@jolly-pixel/asset.voxel-map/server` exports `VoxelCommandArbiter`, `BlocksetCommandArbiter`, and the protocol and snapshot schemas of both rooms.

The package root imports server dependencies. Browser code should use the client entry point. See the [network API](./docs/network.md) for command and lifecycle details and [architecture](./ARCHITECTURE.md) for state ownership and conflict keys. The world and blockset document formats and voxel commands are documented by [voxel.renderer](../../voxel-renderer/docs/api/core/commands.md).

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.voxel-map test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
