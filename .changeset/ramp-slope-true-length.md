---
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/pixel-draw.renderer": minor
---

A ramp slope with its own tile now samples its true `√2` length (16 by 23 texels on 16-texel tiles) through the new `TileSpan`; shared `defaultTexture` tiles stay square.
`UVSlotGeometryTemplate` accepts a per-slot `width` and `height`.
