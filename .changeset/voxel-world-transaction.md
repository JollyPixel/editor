---
"@jolly-pixel/voxel.renderer": minor
---

Add `VoxelWorld.transaction()` for bulk writes: dirty chunks are marked once, the history records one step, and changed cells go out as one `"voxels-patched"` command per layer.
Add `patchVoxels()`, the fastest bulk write for world generation, and the `VoxelPatchCells` helpers.
