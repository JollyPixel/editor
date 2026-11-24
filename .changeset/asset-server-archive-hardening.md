---
"@jolly-pixel/asset-server": minor
---

Archives reject a part listed twice. `exportAssetArchive` takes `limits`, and `catalog:export` applies the same `archiveLimits` as import, defaults included.
Part IDs are capped at `ASSET_PART_ID_MAX_LENGTH` (128) everywhere, and a room member's subscriptions at `ASSET_ROOM_MAX_SUBSCRIBED_PARTS`.
