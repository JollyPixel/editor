---
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/editor.pixel-art": minor
"@jolly-pixel/editor.voxel-map": minor
---

Add `buildShapeGeometry()`, which triangulates a `BlockShape` and reports the
vertex range each face slot owns. UV editing in voxel-map now derives its
topology from the shape, so every built-in and custom shape is supported.
