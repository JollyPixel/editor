---
"@jolly-pixel/voxel.renderer": minor
---

Box-filter distant tiles over the pixel footprint from the summed-area table, and add `range.farDistance` (flat tile colour, opaque blend blocks) and `rendering.alphaToCoverage`.
The transparency pass weights depth over the camera range.
