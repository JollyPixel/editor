# Voxel-model network API

The browser entry point is `@jolly-pixel/asset.voxel-model/client`. Server protocol utilities are exported from `@jolly-pixel/asset.voxel-model/server`. Use `assetRoomName("voxelmodel", assetId)` to name the room.

## Synchronization

`new SyncedModelDocument(room)` creates a [`ModelDocument`](./model.md) as `document` with a private sync client. Construct it before `room.join()`. Its `ready` promise resolves after the first snapshot and `loaded` reports it; `dispose()` destroys the sync client. The caller still leaves the room and owns the shared network client. `voxelModelDocumentKind()` provides the corresponding `@jolly-pixel/editor.host` lease adapter.

The sync client is a `DocumentSyncClient` from `@jolly-pixel/network/client`, keyed by `voxelModelWriteKeys`. It sends local changes, an undo or redo with the `basis` of its step, and writes the server's answers to `document.receipts`, so a [`CommandHistory`](./history.md) refuses steps a peer overwrote. Local commands stay pending until the server acknowledges them. A peer command is applied under the pending commands, which are then replayed on top with a `"replay"` origin. A pending command the tree now refuses, such as a move into a removed folder, leaves the tree until the server's snapshot repairs it. Snapshots call `document.load()`. To listen to the sync client's `snapshot`, `ready`, `command` and `notice` events, build it yourself with `new DocumentSyncClient(room, { document, keys: voxelModelWriteKeys })`; notices report rejected edits or asset deletion.

## Wire data

`VoxelModelSnapshot` is `{ nodes, materials, animationSets }`, siblings in array order. The stored document adds a `version` and the `texture` reference, which stay outside the live snapshot. `VoxelModelNetworkCommand` is one of the commands below plus `NetworkCommandHeader` (`clientId`, `seq`, `timestamp`). `VoxelModelServerMessage` carries a command, a snapshot, or an asset notice.

| Command | Payload |
|---|---|
| `node-added` | A full folder or block node, and an optional sibling `beforeId`. |
| `node-removed` | A node ID. Removes its subtree. |
| `node-renamed` | A node ID and a name. |
| `node-moved` | A node ID, the new parent ID, the block transforms the move rewrites, and an optional sibling `beforeId`. |
| `node-transformed` | A block ID, a transform, and optional flip axes. |
| `node-uv-changed` | A block ID and its whole UV layout. |
| `node-material-changed` | A block ID and a material ID, or `null`. |
| `material-added`, `material-folder-added` | A full entry with an unused ID, and an optional sibling `beforeId`. |
| `material-moved` | An entry ID, a new parent folder or `null`, and an optional sibling `beforeId`. |
| `material-removed` | An entry ID, and `keepContents: true` to remove a folder alone. |
| `material-renamed` | An entry ID and a name. |
| `material-changed` | A material ID and a surface patch of one or more fields. |
| `animation-set-linked` | An `AnimationSetLinkJSON` `{ id, kind, bindings, own? }` for a set not linked yet. |
| `animation-set-unlinked` | A linked set ID. |
| `animation-set-owned` | A linked set ID and `own`. |
| `animation-binding-changed` | A linked set ID, a track path, and a `target` block path or `null`. |
| `animation-binding-cleared` | A linked set ID and a track path. |

The [model](./model.md), [material](./materials.md) and [animation](./animation.md) pages describe what each command does.

## Server protocol

`VoxelModelCommandArbiter.admit(state, command)` returns an admission, or `null` when `state.accepts(command)` is false or a conflict key rejects it. `voxelModelConflictKeys(command)` returns the keys listed in [architecture](../ARCHITECTURE.md#collision-keys). `voxelModelWriteKeys(command)` returns the values a command sets, for the client reconciler.

`voxelModelCommandProtocol` validates command messages and `voxelModelSnapshotSchema` validates snapshots.
