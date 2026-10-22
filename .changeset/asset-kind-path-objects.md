---
"@jolly-pixel/asset": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/engine": patch
"@jolly-pixel/runtime": patch
---

Add `AssetKind` and `AssetPath` (replaces `AssetSource`). Records carry `path` instead of `source` in `AssetRecord`, `AssetRecordData` and the catalog protocol, and a kind may no longer contain `@`.
`AssetReference.equals` compares `AssetType` tokens, `AssetCoordinator.catalog`/`loaders` are private, and `evict()` takes a reference and returns its typed value.
