---
"@jolly-pixel/asset-source": major
"@jolly-pixel/event-store": major
---

IndexedDB storage now runs on `idb` and always uses `globalThis.indexedDB`: the `factory` option is removed.
`IndexedDbAssetSource` no longer upgrades databases made before the `folders` store, and `destroy` closes the sources still open on the database instead of waiting for them.
