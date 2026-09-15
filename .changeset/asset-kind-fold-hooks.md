---
"@jolly-pixel/asset-server": major
---

`AssetKindHandler.apply(state, event)` and `live()` are replaced by `load`, `clear` and a `commands` object (`eventType`, `protocol`, `apply`, `live`); commands are validated against the `protocol` JSON Schema on append and replay.
`AssetLiveProtocol` declares a `snapshotSchema` instead of `protocols`, which the room now derives, and no longer carries `commandEventType` or `parse`.
Add `foldAssetEvent()`; `AssetStateStore` folds through it and logs a throwing hook instead of letting it escape.
