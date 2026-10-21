---
"@jolly-pixel/lantern": minor
---

Rename `LanternSession` to `TourRun` (`lantern.current`, `element.run`); `TourRun` and `LanternSeen` are exported as types only.
A run cut short by `Lantern` now ends with the `"interrupted"` outcome, and `run.seek()` replaces `run.page` and `run.warn()`.
