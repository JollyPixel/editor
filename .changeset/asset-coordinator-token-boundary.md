---
"@jolly-pixel/asset": major
---

Remove `AssetLoadContext.signal` and the `options` of `AssetCoordinator.load`: shared loads ignored every caller signal but the first. The coordinator now rejects a foreign `AssetType` token as soon as its kind has a loader, and a throwing `onProgress` is reported as uncaught instead of failing the batch.
Add `AssetLoaderRegistry.find(type)` and `AssetPath.value`.
