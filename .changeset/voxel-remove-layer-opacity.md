---
"@jolly-pixel/voxel.renderer": major
---

Remove layer opacity: a `VoxelLayer` is either visible or hidden, and translucency comes from the block `alphaMode`.
`setLayerOpacity()`, `VoxelLayer.opacity` and `effectivelyVisible` are gone, and world documents no longer store a layer `opacity`.
