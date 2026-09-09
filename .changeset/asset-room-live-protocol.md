---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/voxel.renderer": major
---

Replace the per-kind room extension with a declarative `live()` protocol hosted
by asset-server's new `AssetRoomExtension`. `PixelArtAssetExtension` and
`VoxelMapAssetExtension` are removed; `PixelCommandArbiter.admit()` now defers
recording to the returned arbitration, so a refused append no longer poisons
the conflict trackers.
