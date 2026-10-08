---
"@jolly-pixel/ui": major
---

`LogQueue` drops the `now` and `schedule` options and the `LogScheduler` type: expiry always runs on `setTimeout` and `Date.now()`, which tests drive with `mock.timers`.
