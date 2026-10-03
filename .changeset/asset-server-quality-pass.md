---
"@jolly-pixel/asset-server": major
---

`CatalogProjection` now indexes an `AssetProjector` (`{ projector }`), `backend.internals` is replaced by `backend.reconcile()`, `AssetStateStore.serialize()` is removed, and `exportAssetArchive` returns a `Result` with `UnknownAssetError` for an unknown root.
Live commands extend `AssetCommandHeader`, `broadcast` returns an `AssetBroadcast`, catalog protocol types derive from their schemas, and `builtInAssetKinds()` and `AssetKindRegistry.decode()` are added.
