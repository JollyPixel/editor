# Voxel-animation network API

The browser entry point is `@jolly-pixel/asset.voxel-animation/client`. Server protocol utilities are exported from `@jolly-pixel/asset.voxel-animation/server`. Use `assetRoomName("voxelanimation", assetId)` to name the room.

## Synchronization

`new SyncedAnimationDocument(room)` creates an [`AnimationDocument`](./animation-set.md) as `document` with a private sync client. Construct it before `room.join()`. Its `ready` promise resolves after the first snapshot and `loaded` reports it; `dispose()` destroys the sync client. The caller still leaves the room and owns the shared network client. `voxelAnimationDocumentKind()` provides the corresponding `@jolly-pixel/editor.host` lease adapter.

The sync client is a `DocumentSyncClient` from `@jolly-pixel/network/client`, keyed by `animationWriteKeys`. It sends local changes, an undo or redo with the `basis` of its step, and writes the server's answers to `document.receipts`, so a [`CommandHistory`](./history.md) refuses steps a peer overwrote. Local commands stay pending until the server acknowledges them. A peer command is applied under the pending commands, which are then replayed on top with a `"replay"` origin. Snapshots call `document.load()`. To listen to the sync client's `snapshot`, `ready`, `command` and `notice` events, build it yourself with `new DocumentSyncClient(room, { document, keys: animationWriteKeys })`.

## Wire data

`AnimationSetSnapshot` is `{ rig, clips }`. The stored document adds a `version`. `AnimationNetworkCommand` is one of the commands below plus `NetworkCommandHeader` (`clientId`, `seq`, `timestamp`). `AnimationServerMessage` carries a command, a snapshot, or an asset notice.

| Command | Payload |
|---|---|
| `rig-renamed` | The new label. |
| `clip-added` | A full clip with an unused ID, and an optional `beforeId` naming another clip. |
| `clip-removed` | A clip ID. |
| `clip-changed` | A clip ID and a patch of one or more of `name`, `length`, `fps` and `loop`. |
| `clip-moved` | A clip ID and an optional `beforeId`. |
| `key-set` | A clip ID, a path, a channel and a key. |
| `key-removed` | A clip ID, a path, a channel and the tick of an existing key. |
| `track-removed` | A clip ID and an existing track's path. |
| `track-renamed` | A clip ID, an existing track's path and the new path `to`. |

`ANIMATION_CHANNELS` lists the channels and `ANIMATION_INTERPOLATIONS` the interpolations. The [animation set](./animation-set.md) page describes what each command does.

## Server protocol

`AnimationCommandArbiter.admit(state, command)` returns an admission, or `null` when `state.accepts(command)` is false or a conflict key rejects it. `animationConflictKeys(command)` returns the keys listed in [architecture](../ARCHITECTURE.md#collision-keys). `animationWriteKeys(command)` returns the values a command sets, for the client reconciler, or `null` for clip and track structure commands.

`animationCommandProtocol` validates command messages and `animationSetSnapshotSchema` validates snapshots.
