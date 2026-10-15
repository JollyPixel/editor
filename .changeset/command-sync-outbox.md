---
"@jolly-pixel/network": major
---

`CommandSync` holds every command while disconnected: the offline bound, `overflowed`, `overflow` and `discarded` are removed.
`PendingChanges.keepIn(outbox)` mirrors pending commands into a `ChangeOutbox` and resumes from the restored commands' client id; a pending command whose replay throws is now refused.
