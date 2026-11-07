---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
---

`commandDocumentKind`, `SyncedCommandDocument` and `DocumentSyncClient` take `resolveSnapshot(received, room)` to turn a received snapshot into the loaded value.
`binaryCommands(type, { refAbove })` sends larger content as a content ref when `AssetServer.open({ content })` enables them; `assetServer.contentHandler` serves it, and `resolveBinarySnapshot` fetches it or falls back to the room's `inline-snapshot`.
