---
"@jolly-pixel/event-store": minor
"@jolly-pixel/asset-server": patch
---

Add an optional schema map to the persistence factories: they now return a
`TypedEventStore<TMap>` whose `append` rejects an unknown event type or a
payload that mismatches it, while reads stay `unknown` and still need a guard.
Both backends also got faster through per-asset indexing, one fewer copy per
append, and cached SQLite statements.
