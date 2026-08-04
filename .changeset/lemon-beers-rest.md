---
"@jolly-pixel/voxel.renderer": patch
---

Fix see-through blocks hiding the geometry behind them. `BlockDefinition` gains an optional `transparent` flag: such a block never occludes a neighbouring face, so a tile with alpha holes (leaves, a grate, a window) stops culling what you are meant to see through those holes.
