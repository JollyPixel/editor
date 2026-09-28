---
"@jolly-pixel/voxel.renderer": major
---

Voxel world documents move to version 3: each layer stores a `palette` and run-length encoded `chunks` instead of `"x,y,z"` voxel keys (about 10x smaller, 50x faster to load), and version 2 is rejected. `parseVoxelWorld()` now validates every layer and chunk, and `VoxelEntryKey` is removed.
`VoxelLayer` gains `chunkSize` and `loadPackedChunk()`, and `VoxelChunk` gains `loadPackedEntries()`.
