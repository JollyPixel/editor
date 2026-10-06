# Voxel-animation network API

The browser entry point is `@jolly-pixel/asset.voxel-animation/client`. Server protocol utilities are exported from `@jolly-pixel/asset.voxel-animation/server`. Use `assetRoomName("voxelanimation", assetId)` to name the room.

## Data model

A set is `{ rig, clips }`. `rig` labels the hierarchy the set targets, such as `"Humanoid"`; it is free text and several sets can share it. Clips keep their order. An `AnimationClipJSON` is `{ id, name, length, fps, loop, tracks }`: `length` in ticks, `fps` the frame grid the timeline snaps to, and `loop` either `"loop"` or `"once"`.

Times are integer ticks at `TICKS_PER_SECOND` (24000), whatever the clip's fps. 24000 divides evenly by the usual frame rates, so every frame of those grids is a whole tick and changing a clip's fps never moves a key. `isFrameRate(fps)` tells whether an fps does that, and a clip's fps must. `ticksPerFrame(fps)`, `frameToTick(frame, fps)` and `tickToFrame(tick, fps)` convert between the two, `frameAt(tick, fps)` is the whole frame a tick shows (a clip's length gives its frame count), and `snapToFrame(tick, fps)` is the tick of the nearest frame.

A track is `{ path, position?, rotation?, scale? }`: `path` names a block by its name path (for example `Body/Arm.L`). Paths compare with `trackPathKey`: segment by segment, trimmed and in any case, so `body/arm.l` addresses the same track, which keeps the path it was first written with. `nameKey`, `trackPathKey` and `freeName` are exported for the model package, which binds paths the same way; `trackBlockName(path)` returns the last segment, the block's own name. Each channel holds keys in strictly rising tick order. A key is `{ tick, value: { x, y, z }, interpolation }`, with `interpolation` one of `"step"`, `"linear"` or `"smooth"`. Values are relative to the block's rest pose: position is added, rotation is added per axis in degrees (so a key can spin several turns), and scale multiplies. A track exists while it has a key; removing its last key removes it.

## Sampling

`sampleChannel(keys, tick)` returns a channel's value: the first key's value before it, the last one's after it, and between two keys the earlier key's interpolation: held for `step`, straight for `linear`, eased in and out for `smooth`. It returns `undefined` for no keys. `sampleClip(clip, tick)` returns an `AnimationSample` `{ position?, rotation?, scale? }` per track path, without the channels a track lacks. `clipTick(clip, elapsed)` places a playhead `elapsed` ticks after the start: wrapped for a loop, held at the ends for a one-shot.

## Editable document

`AnimationDocument` owns an `AnimationSetReader` at `set` (`rig`, `size`, `has`, `clip`, `clips`, `trackPaths` (every track path once, by `trackPathKey`, as a clip first wrote it), `nextClipOf`, `clipNameTaken`, `freeClipName`, `keyAt`, `accepts`, `placeable`, `toJSON`; reads return copies). Its edit methods validate a command, apply accepted changes locally, and emit `change` with `origin: "local"`, the `image` of what the command touched as it was, and `inverse`, the commands that undo it (empty for a remote change); an undo or redo change also carries `basis`, the room version of the step it replays, which the sync client sends. The document is a `CommandDocument` from `@jolly-pixel/network/client`: `apply(command, clientId)` applies a remote command the set accepts and returns `false` otherwise; `replayPending(command)` does the same with `origin: "replay"`, for the reconciler re-applying this client's pending commands; `applyStep(command, basis)` applies an undo or redo command as a local edit (`placeable` drops a clip's `beforeId` that is no longer a slot, so it lands last); `load(snapshot)` replaces the set and emits `reset`. `receipts` is the `ChangeReceipts` the sync client fills. `animationHistoryKeys(set)` returns the keys a `CommandHistory` registration needs: the conflict keys plus `clip-content:<id>`, written by any key or track change in the clip and guarded by undoing the clip's creation.

- `renameRig(rig)`, `removeClip(id)`, `changeClip(id, patch)` and `moveClip(id, beforeId?)` return a boolean. `changeClip` takes any of `name`, `length`, `fps` and `loop`.
- `addClip({ name, id?, length?, fps?, loop?, tracks?, beforeId? })` returns the new ID, or `null` when rejected. It defaults to one second at 24 fps, looping, with no tracks, last in the set. `tracks` are copied, so a clip can be copied from another set.
- `setKey(clipId, path, channel, key)` sets the key at `key.tick`, replacing one already there and creating the track when new. `removeKey(clipId, path, channel, tick)` and `removeTrack(clipId, path)` return a boolean. `renameTrack(clipId, path, to)` moves a track and its keys to the path `to`, and returns `false` when another track already holds `to` or the path is unchanged; a change of case only is a rename.

## Wire commands

The snapshot is `{ rig, clips }`. `AnimationNetworkCommand` adds `clientId`, `seq`, and `timestamp` to one of these commands:

- `rig-renamed` carries the new label.
- `clip-added` carries a full clip with an unused ID and an optional `beforeId` naming another clip. `clip-removed` carries a clip ID. `clip-changed` carries a clip ID and a patch of one or more fields. `clip-moved` carries a clip ID and an optional `beforeId`.
- `key-set` carries a clip ID, a path, a channel and a key. `key-removed` carries a clip ID, a path, a channel and the tick of an existing key. `track-removed` carries a clip ID and an existing track's path. `track-renamed` carries a clip ID, an existing track's path and the new path `to`.

`animationCommandProtocol` validates commands and `animationSetSnapshotSchema` validates snapshots. `AnimationCommandArbiter.admit(state, command)` returns an admission, or `null` when `state.accepts(command)` is false or a key rejects it. `animationConflictKeys(command)` returns `rig`, one `clip:id:field` per patched field, `clip-order:id` for a move, `clip-order:id` plus every `clip:id:field` for a removal, and `key:clip:path:channel:tick` for a key (with the path's `trackPathKey`), so concurrent writes to the same value resolve last write wins. A removal is never refused for its keys unless it carries a `basis`, as an undo does: then a peer's newer write to the clip refuses it (keys inside the clip are not covered). Adding clips and adding, renaming or removing tracks rely on validation and room order. `animationWriteKeys(command)` returns the same keys except for moves and structural commands, for the client reconciler.

## Synchronization

`new DocumentSyncClient(room, { document, keys: animationWriteKeys })`, with `DocumentSyncClient` from `@jolly-pixel/network/client`, sends local changes and applies peer commands and snapshots. It keeps each local change's image; a peer command reverts the pending changes with one `load` of the set with those images put back, applies, and replays them. `new SyncedAnimationDocument(room)`, a `SyncedCommandDocument`, creates the document and its sync client; `ready` resolves after the first snapshot and `dispose()` destroys the sync client. `voxelAnimationDocumentKind()` exposes the same construction through a `@jolly-pixel/editor.host` document-kind adapter.
