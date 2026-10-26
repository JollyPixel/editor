---
"@jolly-pixel/history": major
"@jolly-pixel/network": major
---

Rename `KeyedSnapshot` to `KeyedCapture`, stop exporting `KeyedReads`, and rename `CommandDocument.apply` (and `SyncableDocument.apply`) to `applyRemote`.
`CommandDocument`, `CommandHistory` and `ChangeReceipts` no longer extend `Emitter`: listen with `on`/`off`/`subscribe` (`subscribe` only on receipts); `emit` is private. `CommandChangeInit` is a union keyed by `origin`.
