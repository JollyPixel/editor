---
"@jolly-pixel/event-store": minor
"@jolly-pixel/asset-server": minor
---

Add `reader.listFromCheckpoints()` and `store.compact()`, so a fold that
restarts from a checkpoint stops paying for the depth of the log. Both asset
projections now load from each asset's newest lifecycle checkpoint, and opening
a workspace compacts the events they supersede unless `compactOnOpen` is off.
