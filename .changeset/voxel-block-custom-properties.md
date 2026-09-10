---
"@jolly-pixel/voxel.renderer": minor
---

Add `properties` to `BlockDefinition`, a scalar map carried for game code and
scrubbed of non-scalar values when resolved. Read a copy with
`BlockRegistry.propertiesOf()` or, by world position, with the new
`VoxelEngine.blockAt()` and `VoxelEngine.blockPropertiesAt()`.
