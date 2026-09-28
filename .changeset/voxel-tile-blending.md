---
"@jolly-pixel/voxel.renderer": minor
---

Add blend groups: `BlockDefinition.blendGroup` fades top and bottom faces into neighbouring blocks of other groups, texel by texel along a wavy or Bayer-dithered border, outlined and shadowed.
Groups set width, pattern, priority and exclusions; they live in tileset documents and sync through `blend-group-defined` / `blend-group-removed` commands.
