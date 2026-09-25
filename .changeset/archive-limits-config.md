---
"@jolly-pixel/asset-server": major
---

Add the `catalogArchiveLimits` back-end option (`archiveLimits` on `CatalogExtension`) to set the decoded entry and archive caps of catalog imports.
`readAssetArchive` takes `ArchiveLimits`, which replaces `ReadAssetArchiveOptions`; `catalog/client` now exports it with `DEFAULT_ARCHIVE_MAX_*`, and `./backend` exports `AssetBackendTuning`.
