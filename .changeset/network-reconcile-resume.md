---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/voxel.renderer": minor
---

`CommandSync` keeps a pending ledger acknowledged by echoes and `acks`, and rebases it on every server change through an optional `CommandReconciler`; `Room` gains `resync()` and `resumeWith()`, and `Client` reconnects with backoff and resumes its rooms from the last room `version`.
Asset rooms send `version` and `acks`, answer a resumed join with a `catch-up`, and resolve conflicts in server order (event versions, `basis` for replays); `ConflictTracker` gains `record()` and versioned `commit()`/`reset()`.
Voxel layer commands address layers by `layerId`, order them by a fractional `rank` (world format v4, `reordered` removed) and can rename them; `VoxelWorld.recorder` becomes `addRecorder()`/`removeRecorder()` with `includeUnrecorded`.
