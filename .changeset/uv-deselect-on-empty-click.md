---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add `uv.deselectOnEmptyClick` to `PixelArtCanvasOptions`, controlling whether a
UV-mode click outside every visible region clears the selection (default `true`).
The voxel-map texture editor disables it so the block library keeps ownership of
the UV selection, and now also wires `PixelStrokeGhostSync` and
`SelectionGhostSync` so peers see strokes and selections before they commit.
