---
"@jolly-pixel/asset-server": major
---

Catalog API reshaped: `CatalogProjection`/`CatalogClient` expose `dependencies` (read-only `DependencyIndex`) and `dependentsOf` returns live records; `CatalogExtension` takes one `backend`; `CatalogClient.connect()` replaces `catalogRoom()`.
`requestId` is required on catalog commands and replies; `CatalogSessionArchive` and `ArchiveImportDisabledError` moved to editor.host.
