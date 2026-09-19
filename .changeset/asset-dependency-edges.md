---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/asset": minor
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/pixel-draw.renderer": minor
---

Track asset dependency edges: `AssetKindHandler.dependencies`, a `dependencies` field on write events, a live catalog edge index with boot backfill, and a Vite `launch` option.
`TilesetDefinition.src` is now optional; an asset-backed tileset names its pixels with `asset` instead.
`PixelDocument` now owns edits, history replay and remote sync, so it runs headless and several `PixelArtCanvas` can share one through the new `document` option.
