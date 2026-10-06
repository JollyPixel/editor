---
"@jolly-pixel/pixel-draw.renderer": minor
---

Holding `lineHeld` (usually `Shift`) while dragging a UV region also moves the UV regions and slots nested inside it, recorded as one history entry.
`UVMap` gains `targetsWithin()`, `moveGroup()`, `previewMoveGroup()` and a `batch` option; `PixelDocumentState` gains a `uv` option.
