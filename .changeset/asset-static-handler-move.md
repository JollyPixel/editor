---
"@jolly-pixel/asset-source": minor
"@jolly-pixel/asset-server": major
---

Move `createAssetStaticHandler` and the content-type helpers to `@jolly-pixel/asset-source`.
The handler drops its `kinds` option; pass `registry.contentTypes()` as `contentTypes` instead.
`contentTypesFromKinds`, `DEFAULT_ASSET_PREFIX` and `AssetStaticPluginOptions` are removed (use `AssetKindRegistry.contentTypes()`, `ASSET_URL_PREFIX` and `AssetStaticHandlerOptions`).
