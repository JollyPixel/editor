---
"@jolly-pixel/engine": minor
"@jolly-pixel/runtime": minor
---

Add `Systems.Logger.step()`, which logs an awaited operation as started, done with its duration, or failed.
`RuntimeOptions` accepts a `logger` that receives the startup steps of `create()` and `load()`, then the wait for the first frame.
