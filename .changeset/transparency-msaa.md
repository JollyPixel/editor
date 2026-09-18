---
"@jolly-pixel/voxel.renderer": minor
---

Multisample the `VoxelTransparencyRenderer` offscreen targets, so scenes drawn
through the compositor are antialiased again. The new `samples` option
(default 4) sets the MSAA level; 0 disables it.
