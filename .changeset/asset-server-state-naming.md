---
"@jolly-pixel/asset-server": major
---

Rename the state path exports `IDENTITY_SIDECAR_PATH` to `ASSET_INDEX_PATH` and `CONTENT_OBJECTS_PATH` to `BACKUP_OBJECTS_PATH`; the files on disk keep their paths.
Group the backend options into `catalog`, `reconcile` and `compaction` (for example `catalogMaxContentBytes` is now `catalog.maxContentBytes` and `watch` is `reconcile.watch`); `compaction.onSnapshot` defaults to `compaction.onOpen`.
Remove `AssetServerOptions.compactOnOpen` in favor of `backend.compaction.onOpen`, still on by default. A backend that fails to open now closes what it had started.
