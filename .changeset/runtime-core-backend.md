---
"@jolly-pixel/runtime": minor
---

Add a renderer-agnostic `RuntimeCore` and `RuntimeBackend` contract at `@jolly-pixel/runtime/core`; `Runtime` is now the three.js backend built on it.
Add `runtime.mountPerformanceStats()`. `RuntimeMetrics` takes any metric source for `renderer`.
