---
"@jolly-pixel/asset-server": minor
---

Add ZIP asset archives: `exportAssetArchive`, `readAssetArchive`, `planAssetImport` and `importAssetArchive`.
The catalog room gains `catalog:export`, `catalog:plan` and `catalog:import`, with matching `CatalogClient` methods.
Fix `AssetProjector` dropping an event absorbed while a slower write of the same asset was in flight.
