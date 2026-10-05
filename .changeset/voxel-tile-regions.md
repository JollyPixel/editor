---
"@jolly-pixel/voxel.renderer": patch
---

Moving a block's tiles or renaming it no longer remeshes any chunk: face templates keep tile-local UVs and read each block texture slot's atlas rect from a small region table the view rewrites in place.
Tile moves also stop growing the face template table, which kept every past tile position.
