---
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/runtime": minor
"@jolly-pixel/ui": minor
---

Remove `VoxelEngine`: `VoxelRenderer` exposes `document` and `view`, the codec helpers become `parseVoxelWorld`/`encodeVoxelWorld`/`decodeVoxelWorld`, the `apply*Command()` helpers become `apply()` on `BlockRegistry`, `MaterialGroupList` and `TilesetList` (returning the applied command or `null`), object layers move to `world.objectLayers`, `view.tilesets` becomes `view.atlases`, and the `invalidated` event, `registerTileset()` and `PartialExcept` are gone.
Remove greedy meshing and `retainVertexData`: every chunk is vertex pulled at 8 bytes per face and can be meshed in Web Workers (`meshing.workers`, `runMeshWorker()`); view options are grouped into `rendering`, `lighting`, `range` and `meshing`, adding baked ambient occlusion, chunk shadows, `farDistance`, `alphaToCoverage` and box-filtered distant tiles.
GPU memory is measurable through the voxel `meshMemory` and runtime `geometryMemory`/`textureMemory` metrics with a `bytes` unit in `@jolly-pixel/ui`; fix hidden layers reappearing, stale meshes after `cloneLayer()` and `view.dispose()` clearing the document's tilesets.
