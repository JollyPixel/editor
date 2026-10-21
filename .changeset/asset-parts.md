---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/event-store": minor
---

Add asset parts: a kind may declare `parts` to store its content as a manifest and part files in `<asset>.parts/`, checkpointed one generation per `asset.updated`.
Tags, archives and seeding carry the parts, and a live room streams them: `live().parts` answers `subscribe-parts` and filters each command's broadcast. `CatalogFolders` takes `kinds`; `compact` takes `keep`.
