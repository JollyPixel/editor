---
"@jolly-pixel/voxel.renderer": minor
---

Build chunks nearest the camera first: `rebuildFocus` is renamed `focus`, is
resampled as the focus moves, and `VoxelRenderer` can track an `Object3D`.
Adds an opt-in `viewDistance` that stops meshing chunks beyond a chunk radius
and either hides or unloads the ones that leave it.
