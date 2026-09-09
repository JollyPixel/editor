---
"@jolly-pixel/three": minor
---

Add `Grid.extent`, `Grid.toOptions()`, and `Grid.cloneWith()` to read a grid's live state back as `GridOptions` and rebuild it with per-field overrides.
Callers no longer need to copy every property by hand when changing a construction-only setting such as `plane`, `cell.style`, or `fade.from`.
