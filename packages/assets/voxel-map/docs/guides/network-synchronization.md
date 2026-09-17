# Network synchronization

The network integration sends `VoxelEngine` commands through a room and
folds accepted commands into an authoritative `VoxelMapState`.

```text
VoxelEngine -> VoxelSyncClient -> network.Room
                                      |
                                      v
network clients <- network.Server <- AssetRoomExtension
                                      |
                                      v
                        event log -> voxelMapAssetHandler.apply
```

## Command flow

1. A local engine mutation emits a `VoxelCommand` with a `"local"` origin.
2. `VoxelSyncClient` stamps it with a client ID, sequence, and timestamp, then
   sends it through the room.
3. The asset room validates the command, resolves conflicts, appends it to the
   event log, and broadcasts it. The handler's `apply` folds it into the world.
4. Each client applies the remote command through
   `engine.apply(command, { origin: "remote" })`.

The client only sends `"local"` commands, which prevents the received mutation
from being sent back to the server.

## Snapshots

A newly connected client receives a full `VoxelWorldJSON` snapshot. The server
owns voxel, object-layer, and block-definition state, but does not load render
resources, so its snapshot has no tileset definitions. Clients prepare those
resources before joining.

Block definitions travel as `"block-defined"`, `"block-removed"` and
`"block-moved"` commands on the same engine event, so a client publishes block
edits without asking; the definitions the server accumulates ride along in
every later snapshot.

`"world-replace"` replaces the authoritative state and broadcasts another
snapshot. It bypasses conflict arbitration.

## Conflict resolution

The default `LastWriteWinsResolver` compares commands for the same layer and
voxel position. A later timestamp wins. Equal timestamps use the lexicographically
greater client ID. Commands from the same client as the accepted command remain
valid even when their timestamps move backwards, which supports replayed undo
and redo operations.

Only `"voxel-set"` and `"voxel-removed"` commands have a position conflict key.
Layer structure, object-layer commands, and full-world replacement are not
arbitrated.

[`VoxelCommandArbiter`](../api/network/VoxelCommandArbiter.md) accepts a custom
`network.ConflictResolver` when an integration needs another policy.
