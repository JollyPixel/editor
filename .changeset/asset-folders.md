---
"@jolly-pixel/asset-source": major
"@jolly-pixel/asset-server": major
---

`AssetSource` gains `folders()`, `createFolder` and `deleteFolder`, so empty folders persist, plus `FolderSet`; `watch` callbacks also receive whether a file or a folder changed.
The catalog room lists folders through `CatalogFolders` (`backend.folders`), with `catalog:create-folder`, `catalog:move-folder`, `catalog:delete-folder` and `catalog:folders`; `CatalogClient` adds `folders()`, `createFolder`, `moveFolder` and `removeFolder`.
