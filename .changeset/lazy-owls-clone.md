---
"@jolly-pixel/voxel.renderer": minor
---

Fix `VoxelLayer.clone()` dropping every voxel, and make layer clone and merge
usable: a clone lands above its source under a derived unique name, and a merge
consumes the source, keeping the higher layer's voxels. Adds
`VoxelWorld.moveObjectToLayer()` so reparenting an object is one conflict-keyed
command instead of a remove/add pair that could duplicate it.
