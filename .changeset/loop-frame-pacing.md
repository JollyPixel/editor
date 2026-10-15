---
"@jolly-pixel/loop": minor
---

`FrameScheduler` starts and recovers from panics at half a step, so jittery 60 Hz frames run one step each; add `snapTolerance` to snap deltas to measured refresh periods (`refreshPeriod`, `phaseShift`, `FrameSchedule.snapped`).
Add `FrameRateGovernor`, which halves the render rate while frames keep missing their refresh and retries with backoff.
