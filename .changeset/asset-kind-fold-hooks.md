---
"@jolly-pixel/asset-server": major
---

`AssetKindHandler.apply(state, event)` and `live()` are replaced by `load`, `clear` and a `commands` object (`eventType`, `parse`, `apply`, `live`); `AssetLiveProtocol` no longer carries `commandEventType` or `parse`.
Add `foldAssetEvent()`; `AssetStateStore` folds through it and logs a throwing hook instead of letting it escape.
