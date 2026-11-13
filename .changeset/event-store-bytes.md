---
"@jolly-pixel/event-store": minor
---

`eventData` keeps `Uint8Array` values and reads them back as bytes; SQLite stores them raw in a new `event_bytes` BLOB column, added on open. `$bytes` is now a reserved key.
