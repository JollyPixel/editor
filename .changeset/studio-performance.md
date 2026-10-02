---
"@jolly-pixel/loop": minor
"@jolly-pixel/runtime": minor
"@jolly-pixel/network": patch
---

Add `AnimationLoopFrameSource` (moved from runtime) and `suspendWhenHidden` to loop, and the matching `suspendWhenHidden` runtime option.
Runtime `load({ maxFps })` skips GPU benchmarking and loads `@pmndrs/detect-gpu` on demand.
Concurrent joins of the same dynamic network room now share one resolver call.
