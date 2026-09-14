---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": major
---

The `asset-catalog` room now accepts `catalog:create`, `catalog:rename` and `catalog:delete` commands, attributed through the new `RoomContext.actor`, and rooms of deleted assets broadcast a final `deleted` notice.
`AssetWriter` returns path, kind and path-conflict failures as error results instead of throwing, and refuses a path used by another asset.
Remove `AssetKindHandler.createExtension`; `WorkerExtensionProxy` now implements `dispose()`.
