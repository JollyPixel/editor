---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/asset": minor
---

Extensions can declare `queries`, events a member with `read` rights may still send. The catalog adds `CatalogClient.read(assetId)` as such a query.
Kind resolution picks the longest matching extension (`AssetPath.matchExtension`), and reconciliation re-creates a `binary` asset once a registered kind claims its path.
