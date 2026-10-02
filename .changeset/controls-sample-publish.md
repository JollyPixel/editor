---
"@jolly-pixel/controls": major
---

Breaking: `publishFrameState()` is replaced by `publish(reader)` on `Input` and every device, with `InputReader` `"step"` or `"frame"`; `sample()` reads input without publishing, and `update()` is `sample()` then `publish("step")`.
Each reader sees every edge once, so a fixed-step host samples once per frame and a frame without a step no longer drops edges.
