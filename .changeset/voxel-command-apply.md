---
"@jolly-pixel/voxel.renderer": minor
---

`VoxelWorld.apply()` returns the layer command as applied, or `null` for a no-op, so `engine.apply()` no longer reports or broadcasts layer commands that changed nothing.
