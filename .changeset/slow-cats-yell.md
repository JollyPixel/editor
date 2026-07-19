---
"@jolly-pixel/pixel-draw.renderer": minor
---

`"fill"` mode now routes right-click to the same flood/global fill as left-click, but painted with `brush.secondary` instead of `brush.primary`. `PixelArtCanvas.commitPixels(pixels, slot?)` gained an optional `BrushColorSlot` parameter (defaults to `"primary"`, so existing calls are unaffected).
