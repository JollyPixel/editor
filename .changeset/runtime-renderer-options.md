---
"@jolly-pixel/runtime": minor
---

`Runtime.create()` forwards a `renderer` option to `ThreeRenderer.create()`, and `runtime.renderer` exposes the concrete `ThreeRenderer`.
An explicit `output.pixelRatio` or `output.maxPixelRatio` is no longer overwritten by the GPU detection in `load()`.
