---
"@jolly-pixel/voxel.renderer": patch
---

`VoxelTransparencyRenderer` waits for the canvas size to settle before
reallocating its offscreen targets, removing the FPS drop of a live resize.
