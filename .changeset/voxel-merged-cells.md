---
"@jolly-pixel/voxel.renderer": minor
---

Add merged cells: two complementary shapes can share one cell (`setVoxel({ merge: true })`, `VoxelEntry.partner`, `view.canMergeAt()`, `view.partAt()`), saved and synced through optional `partners` fields; patch partners reference their cell by index (`VoxelPatchBuilder`, `pickVoxelPatch()`, `assertVoxelPatch()`).
Complements are detected from geometry (`ShapeOccupancy`, `BlockComplements`). `localVoxels()`, `packedEntries()` and template voxels yield the partner as a fifth tuple element, and `removeBlocks()` now emits `"voxels-patched"`.
