---
"@jolly-pixel/asset-server": major
---

Narrow the root entry: projection, state, reconciliation and identity stages, `TaskChain`, `contentHash`, `CatalogClient`, `AssetRoom`, `DEFAULT_CATALOG_PATH` and `STATE_DIRECTORY` are no longer exported (use `CATALOG_URL_PATH` and `AssetRoom` from `@jolly-pixel/asset`).
Snapshots go through `AssetWriter.update()`, and `AssetWriter.create()` reuses the sidecar ID of a vacant path; `AssetWriter` and `Reconciler` drop their `source` and `kinds` options, and `texture` declares no `contentTypes`.
