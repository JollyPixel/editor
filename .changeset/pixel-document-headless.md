---
"@jolly-pixel/pixel-draw.renderer": patch
---

`PixelDocument` builds without a DOM: its buffer creates the working canvas on the first `canvas()` call. A canvas loaded with `loadTexture()` now also has image smoothing off.
