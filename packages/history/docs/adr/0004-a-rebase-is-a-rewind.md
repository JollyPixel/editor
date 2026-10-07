---
status: accepted
---

# A rebase is a rewind, not a reload

`CommandDocument.revert()`, used by a reconciler to roll pending changes back before a peer's, emits
`reset("rewind")`; `load()` emits `reset("load")`. `CommandHistory` ignores a rewind: the pending
changes are replayed right after with origin `replay`, which recaptures the guards. A load refuses
the settled steps whose capture no longer holds.

Before the cause existed, a rebase went through `load()` and refused settled steps a pending local
change had overwritten, blaming a peer. voxel-model hit it whenever an unkeyed command took the
rebase path. voxel-renderer emits no reset for a rebase: its reconciler applies the rollback and the
replay as `"replay"` commands, which only recapture.

An undo whose step has no confirmed version yet replays with `basis` 0. The server accepts it only
while this client is still the last writer of the key.

## Consequences

- A document that rolls back through `load()` must give the cause, or steps get refused.
