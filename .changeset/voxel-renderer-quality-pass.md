---
"@jolly-pixel/voxel.renderer": major
---

Move object layers to `world.objectLayers`, drop the document `invalidated` event and `registerTileset()`, rename `view.tilesets` to `view.tilesetManager`, make the `apply*Command()` helpers return the applied command or `null`, and replace the exported `PartialExcept` helper with `VoxelLayerCloneOptions`.
Fix hidden layers reappearing when their chunks re-enter the view distance, stale meshes after `cloneLayer()`, duplicate layer orders after a removal, and `view.dispose()` clearing the document's tilesets.
