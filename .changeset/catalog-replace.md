---
"@jolly-pixel/asset-server": minor
---

Add the `catalog:replace` command and `CatalogClient.replace(assetId, content, { from })`: new content for an existing asset, keeping its ID and path.
The overwritten content gets a `restore/<eventVersion>` restore point, and open rooms reload the new content.
