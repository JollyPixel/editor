---
"@jolly-pixel/engine": minor
"@jolly-pixel/ui": patch
---

`OrbitFlyCamera` "lock" mode zooms the pivot distance by a ratio per wheel notch (new `pivotZoomStep`, default 0.1), throws a `RangeError` when `minPivotDistance` is not above 0, and `scrollSpeed` now only applies to "elastic" mode.
Clicking a `jolly-presence-stack` avatar no longer takes focus, so a following Space press reaches the viewport.
