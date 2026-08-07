---
"@jolly-pixel/pixel-draw.renderer": minor
---

Expose `hasTransparency(rect)` on `PixelArtCanvas`, delegating to the underlying buffer, so consumers can check for transparency without reaching into private internals.
