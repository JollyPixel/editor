# Voxel-model network API

Syncs a [`ModelDocument`](./model.md) through a `voxelmodel:<assetId>` room. Browser code imports `@jolly-pixel/asset.voxel-model/client`; asset-server code imports `@jolly-pixel/asset.voxel-model/server`.

```ts
import { AssetRoom } from "@jolly-pixel/asset";
import {
  voxelModelDocumentKind,
  type VoxelModelRoom
} from "@jolly-pixel/asset.voxel-model/client";

const room: VoxelModelRoom = client.room(new AssetRoom("voxelmodel", assetId).toString());
const synced = voxelModelDocumentKind().createDocument(room);
room.join();
await synced.ready;

// On teardown: synced.dispose(); room.leave();
```

## Synchronization

- `voxelModelDocumentKind()` is the `@jolly-pixel/editor.host` lease adapter, built with network's `commandDocumentKind`. `createDocument(room)` returns a `SyncedModelDocument`: a network [`SyncedCommandDocument`](../../../network/docs/client/CommandSync.md#syncedcommanddocument) over a new `ModelDocument`.
- Call `createDocument()` before `room.join()`. `dispose()` destroys the sync; the caller still leaves the room.
- The sync is a `DocumentSyncClient` keyed by `voxelModelWriteKeys`. Undo and redo carry the `basis` of their step, and the server's answers reach `document.receipts`, so the [history](./history.md) refuses steps a peer overwrote.
- A pending command the tree now refuses, such as a move into a removed folder, stays out of the tree until the next snapshot.
- To listen to `snapshot`, `ready`, `command` and `notice`, build the client yourself: `new DocumentSyncClient(room, { document, keys: voxelModelWriteKeys })`.

## Wire data

```ts
interface VoxelModelSnapshot {
  nodes: ModelNodeJSON[]; // siblings in array order
  materials: MaterialEntryJSON[];
  animationSets: AnimationSetLinkJSON[];
}

type VoxelModelCommandAction =
  | "node-added" | "node-removed" | "node-renamed" | "node-moved"
  | "node-transformed" | "node-uv-changed" | "node-shape-changed"
  | "node-material-changed"
  | "material-added" | "material-folder-added" | "material-moved"
  | "material-removed" | "material-renamed" | "material-changed"
  | "animation-set-linked" | "animation-set-unlinked" | "animation-set-owned"
  | "animation-binding-changed" | "animation-binding-cleared";
```

- `VoxelModelNetworkCommand` is a `VoxelModelCommand` plus the network command header.
- The stored document adds a `version` and the `texture` reference, which the live snapshot leaves out.
- The [model](./model.md), [materials](./materials.md) and [animation](./animation.md) pages describe each command.

## Server protocol

- The kind arbitrates with a network [`KeyedCommandArbiter`](../../../network/docs/client/CommandSync.md#conflict-resolution): a command is refused when `state.accepts(command)` is false or it loses one of its `voxelModelConflictKeys(command)`. [Architecture](../ARCHITECTURE.md#collision-keys) lists the keys.
- `voxelModelWriteKeys(command)` returns the values a command sets, for the client reconciler.
- `voxelModelCommandProtocol` validates commands and `voxelModelSnapshotSchema` validates snapshots.
