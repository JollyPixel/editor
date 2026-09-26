---
"@jolly-pixel/voxel.renderer": major
---

Replace `VoxelTransparencyRenderer` with `VoxelTransparencyPassNode` (`voxelTransparencyPass()`), a `PassNode` that resolves weighted blended transparency as a TSL node, so it can be a camera's post-processing output and feed further effects.
