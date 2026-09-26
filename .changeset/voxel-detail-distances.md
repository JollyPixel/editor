---
"@jolly-pixel/voxel.renderer": minor
---

Box-filter distant tiles over the pixel footprint from the summed-area table, and add `farDistance` (flat tile colour, opaque blend blocks), `lodDistance` (half-resolution chunk meshes) and `alphaToCoverage` to `VoxelEngine`.
`enableTileWrapping()` and `enableTileClamping()` now take an options object, and the transparency pass weights depth over the camera range.
