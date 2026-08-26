---
"@jolly-pixel/pixel-draw.renderer": minor
---

`CanvasBuffer` now emits `changed` with dirty bounds, plus `resized` and `replaced`. `PixelDocument` forwards them and is exposed as `PixelArtCanvas.document`, replacing `PixelDocument.onChange`/`offChange`.
