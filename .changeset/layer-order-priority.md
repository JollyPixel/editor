---
"@jolly-pixel/voxel.renderer": major
---

Flip the meaning of `VoxelWorld.moveLayer()` directions: `"up"` now raises a
layer's compositing priority and `"down"` lowers it. The voxel-map layer tree
lists layers highest priority first, so the layer on top renders on top.
