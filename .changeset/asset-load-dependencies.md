---
"@jolly-pixel/asset": minor
---

A loader's `AssetLoadContext` now carries `assets`, which loads the assets its value depends on into the same coordinator and exposes the catalog; `AssetCoordinator.load` and `AssetLoadBatchOptions` take the new `AssetLoadOptions` (`signal` only).
Add `AssetPath.resolve(specifier)`, which resolves a relative specifier like a URL, and `AssetCatalog.findByPath(path)`.
