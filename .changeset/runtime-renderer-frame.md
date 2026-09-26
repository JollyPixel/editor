---
"@jolly-pixel/runtime": minor
---

Expose the renderer counters as `runtime.metrics.renderer`: `frame` returns the draw calls and triangles latched on the last `draw`, safe to read outside a draw handler.
