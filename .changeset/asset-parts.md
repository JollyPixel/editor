---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/event-store": minor
---

Add asset parts: a kind may declare `parts` to store its content as a manifest and part files in `<asset>.parts/`, checkpointed one generation per `asset.updated`.
Tags, archives and seeding carry the parts; `CatalogFolders` takes `kinds` to hide parts folders. `compact` takes `keep`, event positions it leaves in place as a tag does.
