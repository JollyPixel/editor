---
"@jolly-pixel/pixel-draw.renderer": major
---

Add `pickColorArmed`/`pickColorAt` to `PixelArtCanvas` for picking a color from the canvas as an addition to `"paint"` mode (arm the picker to have the next click sample a pixel into the brush color, or call `pickColorAt(x, y)` directly). Remove the right-click eyedropper — right-click no longer picks a color and is reserved for a future secondary-color action.
