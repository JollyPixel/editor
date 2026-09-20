---
"@jolly-pixel/voxel.renderer": minor
---

Draw blocks of a removed tileset with a red missing-tileset texture (`MISSING_TILESET_ID`, `TilesetManager.resolve()`) instead of hiding them.
Blocks whose declared tileset has no texture yet no longer cull their neighbours, which left holes in the mesh.
