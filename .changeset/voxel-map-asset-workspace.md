---
"@jolly-pixel/voxel.renderer": major
---

Move voxel-map persistence and collaboration into `@jolly-pixel/asset.voxel-map`,
and remove the renderer's `/asset` and `/network` exports. `VoxelRenderer` and
`TiledMapAssetLoader` move to the new `plugins/engine/index.ts` and
`plugins/tiled/asset.ts` entry points, whose `@jolly-pixel/engine` and
`@jolly-pixel/asset` requirements are declared as optional peers.
