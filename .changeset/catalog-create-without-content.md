---
"@jolly-pixel/asset-server": minor
---

`catalog:create`, `CatalogClient.create` (with `null` content) and `AssetWriter.create` accept no content and write the kind's default state.
Handlers can declare `companions`, created and linked beside an asset created without content; `AssetKindDescriptor` gains `extension`.
