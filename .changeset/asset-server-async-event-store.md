---
"@jolly-pixel/asset-server": major
---

Follow the async event store: `AssetTags.list`, `read` and `delete` return promises, and `LiveAssetRoom.connect`, `receive` and `resync` must be awaited.
`foldAssetEvent` takes the held part contents from the new `heldPartRefs()` and `loadHeldParts()` instead of an event reader, and asset rooms handle one command at a time.
