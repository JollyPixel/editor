---
"@jolly-pixel/asset": major
"@jolly-pixel/asset-server": minor
---

`AssetCatalog` gains `find()` and `set()`; `replace()`, `firstOfKind()`, the `fetch`/`text`/`sourceUrl` helpers, `assetSourceUrl`, `AssetKindNotFoundError` and `AssetFetchError` are removed. `parse()` methods validate with zod and throw `ZodError`, and kinds reject a colon everywhere.
`AssetStore` is internal: `AssetCoordinator.evict()` replaces `coordinator.store`, requests no longer create entries, and `loadBatch()` accepts `signal`. `LAUNCH_ELEMENT_ID` moves to `@jolly-pixel/asset-server`.
