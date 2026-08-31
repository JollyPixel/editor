---
"@jolly-pixel/voxel.renderer": patch
---

Cull the face two neighbours of the same transparent block share. Emitting both
put two coplanar quads on one plane, which z-fought into visible crackling
across dense foliage. A transparent block still hides nothing of a different
block, so its alpha holes keep revealing what is behind them.
