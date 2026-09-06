---
"@jolly-pixel/voxel.renderer": major
---

`VoxelCommandArbiter.resolve()` is replaced by `admit()`, returning the part of a
command that wins conflict resolution. Bulk voxel commands now contend cell by
cell instead of bypassing the arbiter entirely.
