---
"@jolly-pixel/loop": minor
"@jolly-pixel/engine": minor
---

Time scale support: `FrameSchedule.unscaledDelta`, `GameLoop.step()` for frame-by-frame debugging, and a step budget that grows with `timeScale` above 1.
Add `world.time` (game, wall-clock and fixed-step time); `Camera3DControls` and `OrbitFlyCamera` move in wall-clock time, so they work in slow motion and while paused.
`World.tick` samples input once per frame and publishes it to each fixed step and to the rendered frame, so a press on a frame without a step reaches the next one.
