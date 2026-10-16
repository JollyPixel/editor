---
"@jolly-pixel/engine": minor
"@jolly-pixel/runtime": minor
---

`ThreeRenderer` compiles every render pipeline asynchronously and adds `pendingCompiles`, `compiled()` and a `compiled` event; `Renderer` gains `compiled()`.
`Runtime` requests a frame when compiles settle and adds `compiledFrame()`.
