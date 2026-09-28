---
"@jolly-pixel/voxel.renderer": minor
---

Add `rendering.tileMinification` (default `"average"`): distant faces box-filter their tile over two pixel footprints from a summed-area table (`AtlasAverages`) instead of shimmering under nearest sampling.
Baked ambient occlusion fades to its face average the same way, so distant creases no longer alias into lines.
