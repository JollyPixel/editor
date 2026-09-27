---
"@jolly-pixel/voxel.renderer": patch
---

Cheaper shadow maps: chunk materials cast with a lean color graph (no atlas filtering or ambient occlusion for opaque surfaces) and pulled chunks with a position-only vertex stage. Pulled faces draw as indexed quads.
