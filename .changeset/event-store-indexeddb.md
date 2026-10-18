---
"@jolly-pixel/event-store": minor
---

Add `persistence.indexeddb({ name, factory? })`, a browser backend that keeps the log in memory and writes every append, tag change and compaction to IndexedDB before returning.
`persistence.indexeddb.destroy({ name, factory? })` deletes that database.
