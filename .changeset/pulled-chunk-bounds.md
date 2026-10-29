---
"@jolly-pixel/voxel.renderer": patch
---

`PulledChunkGeometry.computeBoundingBox()` and `computeBoundingSphere()` keep the chunk's cell bounds instead of measuring the template quad, so bounding-box highlights and raycasts stay correct after a recompute.
