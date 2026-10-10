---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add `UVMap.overflow` so UV regions can be moved, resized and rotated past the texture edge, up to a limit in texture pixels or without one (`Infinity`), and `UVMap.bounds` to read the resulting area; UV mode outlines the limit with a faint dashed rectangle labelled "UV limit".
Remote `uv-region-moved` commands now keep the position they were sent with (`UVMap.restoreMove()`), so peers with different overflows stay in sync.
