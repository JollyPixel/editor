---
"@jolly-pixel/voxel.renderer": major
---

Enforce the reserved air id at the write path. `packVoxel()` now throws on block
id 0 instead of storing a phantom voxel, and `BlockRegistry`'s constructor
rejects an air definition like `register()` already did rather than skipping it.
`AIR_BLOCK_ID` and `isAir()` are exported.
