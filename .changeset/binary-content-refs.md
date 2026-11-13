---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
---

`commandDocumentKind`, `SyncedCommandDocument` and `DocumentSyncClient` take `resolveSnapshot(received, room)` to turn a received snapshot into the loaded value.
`binaryCommands(type, { refAbove })` sends larger content as a content ref when `AssetServer.open({ content })` enables them, also to members present on a replace; the previous ref resolves until the next replace. `assetServer.contentHandler` serves refs, and `resolveBinarySnapshot` fetches one or falls back to the room's `inline-snapshot`.
