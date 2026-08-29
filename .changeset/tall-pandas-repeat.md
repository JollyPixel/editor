---
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/three": minor
"@jolly-pixel/engine": patch
---

Rebuild the layers tab around one tree holding objects as rows, with a single
add dialog, per-object color and lock, and editable properties. Adds
`AreaBox.color`, `VoxelObjectJSON.color`/`locked`, and stops `disposeObject3D`
freeing the resources a self-disposing node already released.
