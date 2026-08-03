---
"@jolly-pixel/voxel.renderer": minor
---

Add optional greedy meshing to `VoxelEngine`, merging coplanar identical block faces into the largest quads possible instead of emitting one quad per voxel face. On the bundled noise-terrain benchmark it cuts triangles from 1,986,252 to 666,370 (3x) for roughly the same build time.
