---
"@jolly-pixel/runtime": minor
---

`load()` without `maxFps` no longer benchmarks the GPU or requests unpkg.com: it renders at the display rate and halves it while frames keep missing. Pass `maxFps` to keep a fixed cap.
