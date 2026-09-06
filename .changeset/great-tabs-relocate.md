---
"@jolly-pixel/editor.voxel-map": patch
---

Add a Blocks sidebar tab showing the block library at full height, and move the
library out of General into the Paint tab. One shared `block-library` element is
projected into whichever tab is active, so its preview grid is never rebuilt.
