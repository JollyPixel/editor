---
"@jolly-pixel/engine": major
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/runtime": patch
"@jolly-pixel/physics": patch
---

Drop `get`/`set` method prefixes. `Transform` exposes read-only `local` and `global` spaces that own `move`, `rotate` and `place` (`transform.global.position = v`); actors use `findComponent`, `findActor` and `reparent`; renderers expose `source` and `lockAspectRatio`; sprite, model animation and logger setters become properties.
`VoxelWorld`, `VoxelLayer` and `VoxelChunk` read with `voxelAt`, `packedAt`, `partnerAt`, `findLayer`, `chunkAt`, `chunks()` and write with `placeVoxel`, `writeVoxelAt` and `writePackedAt`; block registries drop `values()` for iteration.
