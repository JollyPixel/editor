---
"@jolly-pixel/loop": minor
"@jolly-pixel/engine": patch
---

Add `renderDelta`/`unscaledRenderDelta` so `update` and `world.time` include frames skipped by `maxFps`; renders land on the nearest frame so a cap at the display rate no longer drops frames.
