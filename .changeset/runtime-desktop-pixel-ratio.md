---
"@jolly-pixel/runtime": patch
---

`load()` now renders desktop displays at their native pixel ratio, up to `2`, instead of capping it at `1`, which blurred scaled and HiDPI screens.
