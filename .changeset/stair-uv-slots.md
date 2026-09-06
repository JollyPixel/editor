---
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/pixel-draw.renderer": major
---

Texture a block per shape slot instead of per face, so stairs expose every quad
they render: `faceTextures` is keyed by slot, `UVFace` is an open string, and a
slot holding several polygons draws as a compound outlined along the union of
its parts, so a stair side reads as one L rather than two stacked rectangles.
Collapsing a region stacks every slot on the shared rectangle and always takes
the largest face. The `PosX`, `NegX`, `PosY` and `NegY` projectors no longer
mirror their tile, with the horizontal faces keyed to the back of the block.
