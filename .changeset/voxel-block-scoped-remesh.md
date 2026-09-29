---
"@jolly-pixel/voxel.renderer": patch
---

Redefining a block remeshes only the chunks holding it (and their neighbours when its shape, occlusion, culling or blend group changed) instead of the whole world.
Chunk materials no longer used stay compiled for reuse, up to sixteen.
