---
"@jolly-pixel/pixel-draw.renderer": minor
"@jolly-pixel/voxel.renderer": minor
---

Add 90° UV rotation: `UVMap.rotate()` turns stacked and unfolded regions whole and free slots one at a time (`R`/`Shift+R`), stored as `rotation` on the slot geometry, and `UVMap.move()` now keeps the region's size.
`ResolvedTileRef.rotation` turns a tile inside its face, and odd turns swap the footprint.
