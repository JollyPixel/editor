---
"@jolly-pixel/runtime": patch
---

`start()` after `stop()` resumes the runtime again: it clears the exit flag `stop()` sets, which previously stopped the runtime on its first tick.
