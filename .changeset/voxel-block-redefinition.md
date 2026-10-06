---
"@jolly-pixel/voxel.renderer": minor
---

The `"command"` context of a `"block-defined"` command carries `redefinition` (`BlockRedefinition`), telling what changed from the replaced definition.
`VoxelView` reads it instead of tracking block definitions itself, and no longer remeshes for a `name` or `properties` change.
