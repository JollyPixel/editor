---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add `FillTool.uvClip` to keep a fill inside the seed's UV slots, or outside every slot; a clipped global fill syncs as a `stroke`.
Add `PixelArtCanvas.clearTexture({ includeUV })`, which keeps UV slot pixels by default, and optional masks on `Fill.floodFill()`/`Fill.matchAll()`.
