---
"@jolly-pixel/asset-server": minor
---

`AssetRoomExtension.onMessage` takes the command the network server already validated and no longer parses it a second time.
`CatalogClient.toSnapshot()` returns its current state as a `catalog:snapshot` message.
