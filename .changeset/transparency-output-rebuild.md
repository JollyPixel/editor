---
"@jolly-pixel/voxel.renderer": patch
---

Rebuild the `VoxelTransparencyRenderer` resolve pass when the renderer's tone
mapping or output color space changes, so runtime switches take effect.
