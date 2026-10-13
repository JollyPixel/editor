---
"@jolly-pixel/network": minor
"@jolly-pixel/asset": minor
"@jolly-pixel/asset-server": minor
---

Tag rooms: `AssetRoom` takes an optional `tag` (`kind@tag:assetId`), and the asset-server resolves such a room read-only with the tagged content through `AssetTags.read()`.
Network `RoomResolution.readOnly` caps every message right of a resolved room at `read`, and `RightsGate.configured` becomes `gated`; `TagName` (with `isRestorePoint`) and `InvalidTagNameError` are exported from `@jolly-pixel/asset-server/client`.
