---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add `hasTransparency(rect)` to `CanvasBuffer`/`PixelBuffer`, reporting whether any pixel in a rect isn't fully opaque. Out-of-bounds cells count as transparent, matching `samplePixel(s)`'s existing convention.
