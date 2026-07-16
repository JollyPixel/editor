---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add a paint-bucket fill mode: set `mode: "fill"` and left-click flood-fills the 4-directionally connected region of same-colored pixels with the current brush color/opacity. New `FillTool` class implements the algorithm; `CanvasManager.commitLine` is renamed to `commitPixels` (now used by both the line and fill tools); `InputActions` gains a required `onFillStart` method. `CanvasBuffer.drawPixels` now syncs its canvas mirror with a single bounding-box `putImageData` call instead of one per pixel, benefiting any large stroke.
