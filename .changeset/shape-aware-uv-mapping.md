---
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/pixel-draw.renderer": minor
"@jolly-pixel/editor.voxel-map": minor
---

Map every UV face to the shape it belongs to, so a pole or slab edits and
renders over the part of its tile the geometry actually covers.

- Built-in shapes state each face's UVs as its own footprint, exposed through
  `projectFaceUv()`, `faceUvs()` and `projectedFace()`.
- The voxel-map UV editor derives per-face regions from the block's shape and
  leaves only a plain cube collapsible.
- A collapse round-trip keeps each face's own size, and collapses onto the
  largest active face rather than the smallest.
- Chunk materials clamp each face to its atlas rect, so atlases ship unpadded
  and a UV rect at a fractional offset stops sampling the tile gutter.
