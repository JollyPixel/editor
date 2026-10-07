---
status: accepted
---

# `CommandReconciler.revert` keeps its name

The contract of `revert(pending)` is: make replaying `pending` after the incoming command correct,
or return `false` to ask for a snapshot. `DocumentReconciler` and voxel-map's `VoxelReconciler`
roll back; pixel-art and blockset return `true` and do nothing, because absolute writes replay over
anything. The contract is documented instead of renaming the method to `rewind`.

`SyncedCommandDocument` stays: it adapts `DocumentSyncClient` to editor.host's `SyncedDocument`
(`document`, `ready` as a promise, `dispose`).

## Considered Options

- **Rename to `rewind`.** Closer to what two of four implementations do, wrong for the other two,
  and a break in every reconciler.
