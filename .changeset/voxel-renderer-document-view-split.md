---
"@jolly-pixel/voxel.renderer": minor
---

Split `VoxelEngine` into a headless `VoxelDocument` (voxels, blocks, tileset
declarations, history, command stream) and a `VoxelView` that draws it.
`VoxelEngine` now composes the two and forwards their members, and accepts an
existing `document` so a synced one can be adopted.
