---
"@jolly-pixel/event-store": minor
---

Add per-asset `tags` that keep their event through compaction (`UnknownEventError`, `EventTagConflictError`) and `reader.get(assetId, eventVersion)`.
SQLite databases gain the `tags` table on their next open.
