---
"@jolly-pixel/asset-server": minor
---

Add `InvalidAssetDocumentError`, thrown by a kind's `load` when its content is not a document of that kind.
`AssetStateStore` logs it at warn level instead of error.
