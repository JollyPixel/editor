---
"@jolly-pixel/voxel.renderer": major
---

Remove atlas padding (`tilesetPadding`, `AtlasLayout`, `TilesetAtlas.sourceTexture`); `TilesetManager.registerTexture(tilesetId, texture)` needs a declared tileset and `get()` replaces `has()`.
Add the `BlockTextures` value object, replacing `tileRefForSlot`, `blockTileRefs`, `blockTilesetIds`, `mapBlockTileRefs` and `assignMissingTileset`.
Drop `powerOfTwoTileSizes`, `rescaleBlockTiles`, `rescaleLeavesBlocksOffGrid` and `TilesetList.preferredTileSize`; rename `ShapeTextureBounds` to `TileBounds`.
