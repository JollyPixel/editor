---
"@jolly-pixel/voxel.renderer": major
---

Rename tilesets to blocksets across the API (`TilesetDocument` to `BlocksetDocument`, `loadTilesets` to `loadBlocksets`, `blocksFromTileset` to `blocksFromTileGrid`, `TilesetTexture` to `AtlasTexture`...).
World JSON and commands now use `blocksets`, `blocksetId`, `defaultBlocksetId` and `blockset-added`/`blockset-removed`, so `VOXEL_WORLD_VERSION` is 5 and older worlds are rejected.
