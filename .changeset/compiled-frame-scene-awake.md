---
"@jolly-pixel/backend.three": patch
---

`runtime.compiledFrame()` now also covers the pipelines of a scene that `load()` just activated, instead of resolving before that scene first draws.
