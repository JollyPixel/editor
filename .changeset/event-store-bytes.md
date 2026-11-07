---
"@jolly-pixel/event-store": minor
---

`eventData` keeps `Uint8Array` values: they are stored as `{ "$bytes": base64 }` and read back as bytes. `$bytes` is now a reserved key.
