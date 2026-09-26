<h1 align="center">
  asset.voxel-map
</h1>

<p align="center">
  Voxel-map and tileset assets
</p>

## 💃 Getting Started

This workspace-private package stores `.voxelmap.json` worlds and the `.tileset.json` tilesets they link. Add `"@jolly-pixel/asset.voxel-map": "workspace:*"` to another workspace's dependencies.

## 👀 Usage example

### Register the kinds

```ts
import {
  tilesetAssetKind,
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
  handlers: [tilesetAssetKind(), voxelMapAssetKind()]
});
```

A tileset owns its pixels, tile size, block definitions and material groups. A world links tilesets by asset reference and stores only its layers; every linked tileset is a catalog dependency of the world. The default `chunkSize` is 16. A map saved with another chunk size still loads, and is saved back with the handler's. The map handler waits 5 seconds after edits before writing a snapshot, with a 60-second maximum delay while edits continue. Pass `snapshot` to change this policy on either kind. `tilesetAssetKind({ tileSize, defaultSize })` sets what a tileset created without content holds.

### Connect a world and its tilesets

Construct the sync clients before joining the rooms. `document` is a `VoxelDocument`; a `VoxelEngine` can be used when the editor also needs rendering.

```ts
import { assetRoomName } from "@jolly-pixel/asset";
import { Client } from "@jolly-pixel/network/client";
import { VoxelDocument } from "@jolly-pixel/voxel.renderer";
import {
  SyncedTileset,
  TILESET_KIND,
  VoxelSyncClient,
  type VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

const client = new Client();
const document = new VoxelDocument();
const room: VoxelMapRoom = client.room(assetRoomName("voxelmap", assetId));
const sync = new VoxelSyncClient({ room, document });
room.join();

const tileset = new SyncedTileset(
  client.room(assetRoomName(TILESET_KIND, tilesetAssetId))
);
tileset.ready.then(() => {
  // tileset.pixels is a PixelDocument, tileset.tileset a TilesetDocument
});

// On teardown: sync.destroy(); tileset.dispose(); room.leave(); client.destroy();
```

The first snapshot loads each document. Local world commands go to the map room; local pixel edits and block, material group and tile size commands go to the tileset room. Accepted remote commands are applied with a remote origin. `sync.replaceWorld(document.save())` sends a full replacement and produces a new snapshot.

## 📚 API

- `@jolly-pixel/asset.voxel-map` exports `voxelMapAssetKind`, `VoxelMapState`, `tilesetAssetKind`, `TilesetState`, `tilesetAsset`, the `VOXEL_MAP_ASSET` and `TILESET_ASSET` descriptors, and the kind and event constants of both kinds for server registration and persistence.
- `createTilesetDocument({ tileSize?, size?, pixels?, blocks?, materialGroups? })` builds a `TilesetAssetDocument`; `tilesetDocumentFromPng(png, { tileSize?, blockLimit? })` wraps an image with one cube block per tile, up to `blockLimit` (32). `encodeTilesetDocument`, `decodeTilesetDocument` and `parseTilesetDocument` are its codec; a malformed document throws `InvalidAssetDocumentError` from `@jolly-pixel/asset-server`. The decoders are only exported from the package root.
- `createVoxelMapDocument({ chunkSize, tilesets?, layer? })` encodes a map linking the given tilesets, each in the first free slot, with one `layer` (`"Ground"`). Loading a map checks it against `voxelWorldSchema`, tileset links included, before the renderer parses it; a malformed map throws `InvalidAssetDocumentError`.
- `@jolly-pixel/asset.voxel-map/client` exports `VoxelSyncClient`, `SyncedVoxelMap`, `voxelMapDocumentKind`, `TilesetSyncClient`, `SyncedTileset`, `tilesetDocumentKind`, `tilesetRoom`, `createTilesetAsset`, the tileset document builders and encoder, wire types, and `tilesetAsset`.
- `@jolly-pixel/asset.voxel-map/server` exports `VoxelCommandArbiter`, `TilesetCommandArbiter`, and the protocol and snapshot schemas of both rooms.

The package root imports server dependencies. Browser code should use the client entry point. See the [network API](./docs/network.md) for command and lifecycle details and [architecture](./ARCHITECTURE.md) for state ownership and conflict keys. The world and tileset document formats and engine commands are documented by [voxel.renderer](../../voxel-renderer/docs/api/core/commands.md).

## ✨ Contributors guide

Read the [contributing guide](../../../CONTRIBUTING.md) before submitting a change. Run `pnpm --filter @jolly-pixel/asset.voxel-map test` and `pnpm run lint` from the monorepo root.

## 📃 License

MIT
