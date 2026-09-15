---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
---

Remove the event store from `@jolly-pixel/network`: `RoomContext` now carries the member `identity` instead of `eventStore`/`actor`, and `ServerOptions.eventStore` is gone.
Asset rooms append through an injected event writer (`registerAssetRooms({ events })`) and send a `rejected` notice to the author when the append fails.
