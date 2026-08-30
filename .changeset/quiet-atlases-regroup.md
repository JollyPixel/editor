---
"@jolly-pixel/voxel.renderer": major
---

Extract `TilesetAtlas` so a registered atlas owns its grid, textures and padding,
leaving `TilesetManager` a registry: `atlas()`/`has()`/`definitions()` replace the
`get*` accessors, and `updateSourceImage`/`updateSourceRegion` collapse into
`TilesetAtlas.updateSource(image, bounds?)`.

`TilesetLoader` becomes `loadTilesets()`, which fetches in parallel and feeds
`VoxelEngineOptions.tilesets`; `getDefaultBlocks` moves to `blocksFromTileset` in
`blocks/`, and `enableTileWrapping` moves to `mesh/`.
