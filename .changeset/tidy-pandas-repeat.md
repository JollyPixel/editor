---
"@jolly-pixel/controls": major
---

Optimize the per-frame and query hot paths: idle devices skip `update()`, mouse position reads avoid forced layout, and queries no longer allocate.
