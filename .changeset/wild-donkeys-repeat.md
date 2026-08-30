---
"@jolly-pixel/voxel.renderer": major
---

`serialization/` now owns the document format end to end: `VoxelSerializer` is
replaced by `serializeVoxelWorld()` / `deserializeVoxelWorld()` (and
`VoxelEngine.serializer` is gone), while `asset/VoxelMapDocument.ts` folds into
a `VoxelMapState` class with `toJSON()` / `load()` / `clear()`.
