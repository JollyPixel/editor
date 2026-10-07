---
"@jolly-pixel/engine": minor
"@jolly-pixel/runtime": minor
"@jolly-pixel/voxel.renderer": minor
---

`ThreeRenderer` emits `deviceLost`, and the runtime logs it as an error. The model loader decodes Meshopt-compressed glTF, and `Transform` no longer allocates on each call.
`VoxelView.meshVersion` counts chunk mesh changes, so a host can keep a static shadow map.
