---
"@jolly-pixel/voxel.renderer": minor
---

Add `meshing.workers` and `runMeshWorker()`: chunks are meshed in Web Workers that read chunk storage through `SharedArrayBuffer` on cross-origin isolated pages.
`VoxelStore` gains `share()` and `fromArrays()`, and the rebuild queue no longer copies its backlog on every drain.
