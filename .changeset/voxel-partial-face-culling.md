---
"@jolly-pixel/voxel.renderer": patch
---

Cull partial boundary faces, such as ramp and stair sides, that an opaque neighbour covers entirely.
Fix `flipX`/`flipZ` voxels culling the wrong sides and rendering their faces with an inverted winding.
