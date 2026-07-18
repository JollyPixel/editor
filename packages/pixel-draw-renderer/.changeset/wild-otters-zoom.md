---
"@jolly-pixel/pixel-draw.renderer": major
---

Extracted zoom state (value, bounds, wheel sensitivity, and delta-stepping math) out of `Viewport` into a new `Zoom` value object, exported from the package. `DefaultViewport.zoom` (and `Viewport.zoom`) is now a `Zoom` instance instead of a plain `number` — use `.zoom.value` for the numeric level and `.zoom.sensitivity` (get/set) instead of the removed `Viewport.zoomSensitivity` accessor pair. `PixelArtCanvas.zoom`/`zoomSensitivity` are unaffected and still return/accept plain numbers. `PixelArtCanvasOptions.zoom` now reuses the exported `ZoomOptions` type instead of an inline duplicate shape; as a result `zoom.default` is no longer required when passing a `zoom` option.
