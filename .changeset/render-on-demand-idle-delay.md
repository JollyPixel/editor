---
"@jolly-pixel/loop": minor
"@jolly-pixel/ui": minor
"@jolly-pixel/runtime": minor
---

`GameLoop` takes an `idleDelay` before it sleeps. The runtime sets it to 2 s with `renderOnDemand` in place of rendering every frame while the pointer hovers the canvas.
`StatsRecorder.skipGap()` keeps the time the loop slept out of the FPS graph.
