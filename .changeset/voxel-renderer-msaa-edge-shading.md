---
"@jolly-pixel/voxel.renderer": patch
---

Vertex-pulled faces sample their AO, light and blend inputs at the centroid and clamp them, so faces seen edge-on no longer draw a bright 1px line under MSAA. Chunk texture nodes stop logging "Abstract function." every frame.
