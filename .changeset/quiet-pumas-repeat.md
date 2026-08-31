---
"@jolly-pixel/voxel.renderer": major
---

Move layer, voxel and object mutations from `VoxelEngine` to `VoxelWorld`, which
now emits the hook events and applies remote commands itself. `VoxelEngine` keeps
rendering, tilesets and persistence, and delegates its chunk meshes, materials,
rebuild queue and view-distance culling to collaborators under `src/render`.
Remote `cloned` and `merged` commands were silently dropped and now apply;
`applyCommandToWorld()` is replaced by `world.applyRemoteCommand()`.
