---
"@jolly-pixel/voxel.renderer": major
---

Opaque layers on the chunk grid now share one set of meshes per chunk cell, so stacked layers no longer multiply chunks, geometries and draw calls; faded or off-grid layers keep their own meshes.
`VoxelChunkCollision` now carries `origin` and `chunks` (every layer chunk of the cell) in place of `chunk` and `layerPosition`.
