# Voxel-map network API

Syncs a `VoxelDocument` through a `voxelmap:<assetId>` room, and a blockset through a `blockset:<assetId>` room. Browser code imports `@jolly-pixel/asset.voxel-map/client`; asset-server code imports `@jolly-pixel/asset.voxel-map/server`.

```ts
import { AssetRoom } from "@jolly-pixel/asset";
import {
  SyncedVoxelMap,
  type VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

const room: VoxelMapRoom = client.room(new AssetRoom("voxelmap", assetId).toString());
const map = new SyncedVoxelMap(room, { chunkSize: 16 });
room.join();
await map.ready;

// On teardown: map.dispose(); room.leave();
```

Pending edits, acknowledgements, rebase and resume follow [`CommandSync`](../../../network/docs/client/CommandSync.md).

## Map synchronization

`new SyncedVoxelMap(room, options?)` is a network [`SyncedDocument`](../../../network/docs/client/CommandSync.md#synceddocument) whose `document` is the map itself, so `voxelMapDocumentKind(options?)` hands it to an `@jolly-pixel/editor.host` lease as is.

- `voxels` is the `VoxelDocument`. Options set its `chunkSize`, initial `layers` and `blocks`, and `logger`.
- `edits` is the document's [`VoxelEdits`](./history.md); the server's answers reach its receipts, so undo refuses steps a peer overwrote.
- `replaceWorld(data)` sends a `world-replace` with a full `VoxelWorldJSON`. The server answers with a snapshot.

### VoxelSyncClient

`new VoxelSyncClient({ room, document })` syncs a document you already own. It is a `CommandSync`; construct it before `room.join()` and call `destroy()` before leaving.

- Only world commands are sent. Block and material group commands stay local, since they come from blockset rooms.
- A peer voxel write skips the cells a pending local write will win. Other peer commands roll the pending ones back and replay them on top with a `"replay"` origin.
- A pending `removed`, `merged`, `position-rebased`, object, template or blockset link command cannot be rolled back, so the client asks for a snapshot instead.

## Blockset synchronization

`new SyncedBlockset(room, options?)` is also its own `document`, and `blocksetDocumentKind(options?)` hands it to a lease. It owns a `pixels` document and a renderer `BlocksetDocument` as `blockset`; options are pixel-art's `{ maxSize? }`. `blocksetRoom(client, assetId)` returns the typed room.

- `new BlocksetSyncClient({ room, pixels, blockset })` sends pixel edits and the blockset document's local commands. Peer pixel commands go to `pixels.applyRemoteCommand()`, others to `blockset.apply(command, { origin: "remote" })`.
- A snapshot loads the blockset, then the pixels. A snapshot with an invalid block loads neither.
- A pending `block-moved` cannot be rebased and asks for a snapshot. Other blockset commands are absolute writes keyed by `blocksetWriteKeys`.
- `createBlocksetAsset(catalog, path, document)` creates a blockset asset, suffixing the path on conflict.

## Wire data

- `VoxelMapNetworkCommand` is a renderer `VoxelWorldCommand` or a `world-replace`, plus the network command header. The renderer's [command reference](../../../voxel-renderer/docs/api/core/commands.md) defines the payloads.
- A map snapshot is a `VoxelWorldJSON`: the layers and the blockset links. A link names an asset (or a URL with its tile size) and the slot its block ids occupy.
- `BlocksetNetworkCommand` is a pixel-art `PixelNetworkCommand` or a renderer `BlocksetDocumentCommand`. Pixel-art's `isPixelCommand()` tells them apart.

```ts
// BlocksetDocumentJSON: tileSize, blocks, materialGroups, blendGroups?
interface BlocksetSnapshot extends BlocksetDocumentJSON {
  pixels: PixelWireSnapshot;
}
```

## Server protocol

- `VoxelCommandArbiter` and `BlocksetCommandArbiter` are network [`KeyedCommandArbiter`](../../../network/docs/client/CommandSync.md#conflict-resolution)s over `VOXEL_COMMAND_RULES` and `BLOCKSET_COMMAND_RULES`. [Architecture](../ARCHITECTURE.md) lists the keys of both rooms.
- A voxel write to a missing layer is refused. Bulk `voxels-set`, `voxels-removed` and `voxels-patched` can be narrowed to the cells that win.
- `world-replace` is admitted when its document loads into a scratch world, and resets every key.
- Blockset pixel commands follow pixel-art's `PIXEL_COMMAND_RULES`. A `block-defined` the renderer's `localBlock()` refuses is rejected.
- A refused or narrowed cell write gets a `voxels-patched` correction from `correctVoxelCommand(state, command, admitted)`, with air for empty cells. Any other refusal gets a snapshot.
- A `blockset-added` that lost its slot to another client is answered with a snapshot broadcast.
- `voxelCommandKeys(command)` and `voxelCellKeys(command)` return the keys the arbiter and the client reconciler share: `<layerId>:x,y,z` per cell and `layer-order:<layerId>` for a `layer-moved`.
- `voxelCommandProtocol` and `blocksetCommandProtocol` validate commands. `voxelWorldSchema` and `blocksetSnapshotSchema` check snapshot headers.

Restricted rooms use the `voxelmap` and `blockset` extensions and their command actions in a rights table. Resolve roles from a trusted server session; see [network rights](../../../network/docs/server/Access.md#rights).
