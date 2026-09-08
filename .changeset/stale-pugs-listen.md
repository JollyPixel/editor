---
"@jolly-pixel/event-store": major
"@jolly-pixel/asset-server": major
---

Move log subscription and single-asset checkpoint reads into the store: `EventStore.subscribe(listener, { eventTypePrefix })` replaces reaching through `writer.on("append")`, and `reader.listFromCheckpoint(assetId, checkpointEventTypes)` replaces `reader.lastVersionOf`.
The sqlite backend now creates the directories its file lives in, so `openAssetEventStore` is gone from `@jolly-pixel/asset-server`.
