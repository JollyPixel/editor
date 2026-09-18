---
"@jolly-pixel/voxel.renderer": minor
---

Add optional `VoxelHistory` undo/redo of voxel edits (`engine.history`, disabled by default, 10 entries),
with `begin()`/`commit()` grouping and replay that keeps cells a peer changed since.
