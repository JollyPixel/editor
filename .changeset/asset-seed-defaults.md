---
"@jolly-pixel/asset-server": minor
---

Make `content` optional on a seed entry: `seedAssetSource` takes `handlers` and writes the serialized `create(id)` state of the entry's kind instead.
Add the `AssetKindDescriptor` type, a kind's label and icon as plain data.
