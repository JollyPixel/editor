---
"@jolly-pixel/asset-server": minor
---

Add `AssetKindHandler.maxContentBytes`, which replaces the catalog's `maxContentBytes` for a create or replace of that kind. The kind registry refuses a value over `MAX_KIND_CONTENT_BYTES` (128 MiB).
`CatalogClient` create and replace throw `CatalogContentTooLargeError` above that ceiling without sending, `MAX_CATALOG_MESSAGE_BYTES` sizes a socket for it, and `LoadedAssetKind` now carries `extensions` and `maxContentBytes`.
