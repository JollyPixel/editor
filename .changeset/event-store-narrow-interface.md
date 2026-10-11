---
"@jolly-pixel/event-store": major
---

`reader.listFromCheckpoint` is replaced by `listFromCheckpoints({ assetId })`, and `writer` exposes only `append`: observe rejected appends with `subscribeRejections`.
`createEventStore`, `EventLog`, `SqliteEventLog` and `SQL_SCHEMA` are no longer exported, and `EventLogClosedError` now is.
