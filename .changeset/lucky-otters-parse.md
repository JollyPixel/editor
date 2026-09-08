---
"@jolly-pixel/asset-server": major
"@jolly-pixel/pixel-draw.renderer": patch
"@jolly-pixel/voxel.renderer": patch
---

Parse asset event payloads instead of validating them. `isAssetEvent` becomes
`parseAssetEvent`, returning `Result<AssetEvent, AssetEventRejection>` that
separates a foreign event from a malformed one; payload types now derive from
the JSON Schemas that check them, and `decodeContent` takes `AssetInlineContent`
so it can no longer throw.
