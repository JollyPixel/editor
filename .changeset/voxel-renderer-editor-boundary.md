---
"@jolly-pixel/voxel.renderer": major
---

Replace the `projectTileset*()`, `localTilesetBlock()`, `belongsToTileset()` and group id helpers with the `TilesetSlot` value object and a live `TilesetLink` between a `TilesetDocument` and a world. `VoxelWorld.setLayerVisible()` is removed in favour of the per-view `view.layerVisibility`.
Add `BlockPieces` (single-block geometry on the mesher's tile UV path), `BlockTextureLayout`, `BlockTextures` `size`/`withSize()`/`staysOnGrid()`, `VoxelTemplate.placedBounds()`/`placedPositionFor()`, `VoxelWorld.removeBlocks()`, `VoxelLayer.positionsOf()`, `objectLayers.getObject()` and `isVoxelLayerGeometryCommand()`.
