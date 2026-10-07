---
"@jolly-pixel/voxel.renderer": minor
---

`VoxelChunk.contentBounds()` returns the exact local bounds of a chunk's voxels, cached until the chunk changes.
`VoxelLayer.localBounds()`, `worldBounds()` and `worldCenter()` now merge those cached chunk bounds, so after an edit they rescan only the edited chunks instead of every voxel.
