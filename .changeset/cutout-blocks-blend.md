---
"@jolly-pixel/voxel.renderer": minor
---

Blend the cutout draw group of `transparent` blocks instead of only alpha-testing
it, so a texel of partial alpha fades rather than coming out solid; the group
still writes depth. Add `BlockDefinition.cullSelfFaces`, which keeps the boundary
two voxels of the same transparent block share, emitted once from its positive
side so the coplanar pair no longer z-fights.
