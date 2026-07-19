---
"@jolly-pixel/pixel-draw.renderer": major
---

`PixelArtCanvas.zoom` now returns the `Zoom` value object (same instance as `viewport.zoom`) instead of a plain `number`, and the separate `zoomSensitivity` getter/setter has been removed. Use `.zoom.value` for the numeric level and `.zoom.sensitivity` (get/set) instead.
