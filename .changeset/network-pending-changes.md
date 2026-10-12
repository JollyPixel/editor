---
"@jolly-pixel/network": minor
---

`CommandSync` emits `unsettled` when `pending` leaves zero, and `settled` also after a discard.
`SyncedCommandDocument.pendingChanges` exposes that count and both events as `PendingChanges`.
