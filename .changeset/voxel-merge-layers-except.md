---
"@jolly-pixel/voxel.renderer": minor
---
`mergeLayers` load option and `world.mergeAllLayers()` accept `{ except }`: named layers stay apart and each run of layers between them merges on its own.
`mergeAllLayers()` now returns the resulting layers as an array and folds merged-away layer properties like `mergeLayer()`.
