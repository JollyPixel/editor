---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/network": minor
"@jolly-pixel/engine": minor
---

Relay schemas move to `AssetCommands.relay`, checked when `registerAssetRooms` starts; handler APIs return `AnyAssetKindHandler`, and `@jolly-pixel/asset-server/testing` adds `LiveAssetRoom` and `mockAssetRoom`.
Add `KeyedCommandArbiter` and `commandDocumentKind` to `@jolly-pixel/network`; breaking: `SyncedCommandDocument` now takes `<TDocument, TNotice>`.
Add `SceneManager.unloadScene(scene)` to `@jolly-pixel/engine`.
