---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": patch
---

Drop `serverMessageProtocol`, `attributeCommand`, `ConflictTracker` and the `ConflictResolver` option; `CommandSync` requires a `reconciler` and makes `sendChange` public.
`KeyedCommandArbiter` takes `writes` (scoped keys or a reset) plus an optional `narrow`; new `SyncedDocument` base class.
