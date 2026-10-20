# Voxel-animation network API

Syncs an [`AnimationDocument`](./animation-set.md) through a `voxelanimation:<assetId>` room. Browser code imports `@jolly-pixel/asset.voxel-animation/client`; asset-server code imports `@jolly-pixel/asset.voxel-animation/server`.

```ts
import { AssetRoom } from "@jolly-pixel/asset";
import {
  voxelAnimationDocumentKind,
  type AnimationRoom
} from "@jolly-pixel/asset.voxel-animation/client";

const room: AnimationRoom = client.room(new AssetRoom("voxelanimation", assetId).toString());
const synced = voxelAnimationDocumentKind().createDocument(room);
room.join();
await synced.ready;

// On teardown: synced.dispose(); room.leave();
```

## Synchronization

- `voxelAnimationDocumentKind()` is the `@jolly-pixel/editor.host` lease adapter, built with network's `commandDocumentKind`. `createDocument(room)` returns a `SyncedAnimationDocument`: a network `SyncedCommandDocument` over a new `AnimationDocument`.
- Call `createDocument()` before `room.join()`. `dispose()` destroys the sync; the caller still leaves the room.
- The sync is a `DocumentSyncClient` keyed by `animationWriteKeys`. Undo and redo carry the `basis` of their step, and the server's answers reach `document.receipts`, so the [history](./history.md) refuses steps a peer overwrote.
- To listen to `snapshot`, `ready`, `command` and `notice`, build the client yourself: `new DocumentSyncClient(room, { document, keys: animationWriteKeys })`.

## Wire data

```ts
interface AnimationSetSnapshot {
  rig: string;
  clips: AnimationClipJSON[];
}

type AnimationCommandAction =
  | "rig-renamed"
  | "clip-added" | "clip-removed" | "clip-changed" | "clip-moved"
  | "key-set" | "key-removed"
  | "track-removed" | "track-renamed";
```

- `AnimationNetworkCommand` is an `AnimationCommand` plus the network command header. The stored document adds a `version` to the snapshot.
- `ANIMATION_CHANNELS` lists the key channels and `ANIMATION_INTERPOLATIONS` the interpolations.
- The [animation set](./animation-set.md) page describes each command.

## Server protocol

- The kind arbitrates with a network `KeyedCommandArbiter`: a command is refused when `state.accepts(command)` is false or it loses one of its `animationConflictKeys(command)`. [Architecture](../ARCHITECTURE.md#collision-keys) lists the keys.
- `animationWriteKeys(command)` returns the values a command sets, for the client reconciler, or `null` for clip and track structure commands.
- `animationCommandProtocol` validates commands and `animationSetSnapshotSchema` validates snapshots.
