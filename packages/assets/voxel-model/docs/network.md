# Voxel-model network API

The browser entry point is `@jolly-pixel/asset.voxel-model/network/client.ts`. Server protocol utilities are exported from `@jolly-pixel/asset.voxel-model/network/server.ts`. Use `assetRoomName("voxelmodel", assetId)` to name the room.

## Editable document

`ModelDocument` owns a `ModelTreeReader` at `tree`. Its edit methods validate a command, apply accepted changes locally, and emit a `change` event with `origin: "local"`. `apply(command)` emits a remote change; `load(snapshot)` replaces the tree and emits `reset`.

- `addBlock({ name, parentId?, id?, transform? })` and `addFolder({ name, parentId?, id? })` return the new ID, or `null` when rejected.
- `remove(id)`, `rename(id, name)`, `move(id, parentId, transforms?)`, and `transform(id, transform, flipAxes?)` return a boolean. A move carries its block transforms in the same command; `transform` targets a block.

`ModelTreeReader` exposes `size`, `has`, `get`, `block`, `values`, `blocks`, `childrenOf`, `subtreeOf`, `enclosingBlockOf`, `transformParentOf`, and `accepts`. Reads return copies. `createBlockTransform(overrides?)` creates the identity transform of a unit block.

## Synchronization

`new ModelSyncClient({ room, document })` sends local document changes and applies peer commands and snapshots. Construct it before `room.join()`. `destroy()` removes document and room listeners; the caller leaves the room and owns the shared network client.

`new SyncedModelDocument(room)` creates both the document and sync client. `ready` resolves after the first snapshot; `dispose()` destroys the sync client. `voxelModelDocumentKind()` exposes the same construction through a `@jolly-pixel/editor.host` document-kind adapter. The sync client inherits `snapshot`, `ready`, `command`, and `notice` events; notices report rejected edits or asset deletion.

## Wire commands

The snapshot is `{ nodes: ModelNodeJSON[] }`. `VoxelModelNetworkCommand` adds `clientId`, `seq`, and `timestamp` to one of these commands:

- `node-added` carries a full folder or block node. `node-removed` carries an ID and removes its subtree; `node-renamed` carries an ID and name.
- `node-moved` carries an ID, new parent ID, and block transforms changed by the move.
- `node-transformed` carries a block ID, transform, and optional flip axes.

`voxelModelCommandProtocol` validates commands and `voxelModelSnapshotSchema` validates snapshots. `VoxelModelCommandArbiter.admit(command)` returns an admission or `null`; `keys(command)` exposes the collision keys described in [architecture](../ARCHITECTURE.md). The stored document also has a version and a required texture reference; these are outside the live snapshot.
