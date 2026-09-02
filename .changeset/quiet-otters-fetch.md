---
"@jolly-pixel/asset": minor
---

Add `AssetCatalog.fetch()` and `AssetRecord.sourceUrl()`/`fetch()`/`text()` so a
catalog and a record can be read from their own URL, plus
`AssetCatalog.byKind()`/`firstOfKind()` for kind lookups. Failed requests throw
`AssetFetchError`, an empty kind lookup `AssetKindNotFoundError`.
