# Network synchronization

The network integration sends `VoxelEngine` hook events through a room and
applies accepted commands to an authoritative `VoxelWorld`.

```text
VoxelEngine -> VoxelSyncClient -> network.Room
                                      |
                                      v
network clients <- network.Server <- VoxelSyncServer
```

## Command flow

1. A local engine mutation emits a `VoxelLayerHookEvent`.
2. `VoxelSyncClient` stamps it with a client ID, sequence, and timestamp, then
   sends it through the room.
3. `VoxelSyncServer` validates the marker fields, resolves conflicts, applies
   the command to its world, and broadcasts the accepted command.
4. Each client applies the remote command through `engine.applyRemoteCommand()`.

The engine suppresses its hook while applying a remote command, which prevents
the received mutation from being sent back to the server.

## Snapshots

A newly connected client receives a full `VoxelWorldJSON` snapshot. The server
owns voxel and object-layer state but does not load render resources, so its
snapshot has no tileset or block definitions. Clients prepare those resources
before joining.

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
