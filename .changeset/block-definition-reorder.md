---
"@jolly-pixel/voxel.renderer": minor
---

Make the block table's order editable and durable. `BlockRegistry.moveTo()`
relocates a definition, `VoxelEngine.moveBlock()` emits it as a new
`block-moved` hook and network command, and the document's `blocks` array
round trips that order.
