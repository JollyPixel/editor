---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/ui": minor
---

Add `CommandHistory`: per-person undo and redo over `CommandDocument`s, synced by `DocumentSyncClient` and owned by `SyncedCommandDocument`, refusing a step a peer changed since.
Resyncs carry `refused` and `CommandSync` emits `"refused"` on rollback; `ChangeReceipts` carries the server's answers about local changes.
`jolly-tree` takes `validateRename` to refuse a rename, and `TreeNode.warning` flags a row with a warning icon.
