---
"@jolly-pixel/voxel.renderer": minor
---

`voxelPositionOf` now resolves the cell from a small offset against the normal
and steps one major axis for the front side, so a slanted face such as a ramp
slope no longer resolves to the cell below or to the ramp's own cell.
