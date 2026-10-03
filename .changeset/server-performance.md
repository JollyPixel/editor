---
"@jolly-pixel/event-store": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/asset-source": minor
"@jolly-pixel/network": patch
---

event-store adds `expectedVersion` appends (`EventVersionConflictError`) and per-asset `compact` (`assetId`); SQLite files open in WAL mode with incremental vacuum.
asset-server snapshots no longer reload live state or drop commands appended while serializing, compacts before snapshots (`compactOnSnapshot`), caches room snapshots per version and reconciles only changed paths; `watch` reports readiness through `onReady` and skips initial and temporary entries.
network room loggers no longer overwrite the shared logger context, and disabled debug logs skip building metadata.
