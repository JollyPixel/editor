---
"@jolly-pixel/asset-server": major
"@jolly-pixel/network": major
---

Readers can subscribe to parts, list tags and send a kind's `AssetRelaySchemas.queries`; `CatalogClient.can()` tells which commands a member may send, and `CommandSync` rolls back refused ones. Replace `Room.access` with `room.can(event)` or `RoomGrants`; custom rooms must emit `rights` and echo `requestId` in refusals.
