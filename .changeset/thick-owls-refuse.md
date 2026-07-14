---
"@jolly-pixel/voxel.renderer": major
---

Extract `VoxelEngine` from `VoxelRenderer` to remove the `@jolly-pixel/engine`
dependency from the core voxel logic (world, layers, blocks, hooks, mesh
building), so it can be used standalone (e.g. server-side). `VoxelRenderer`
now only wires the ActorComponent lifecycle and exposes the engine as
`vr.engine`. `VoxelSyncClientOptions.renderer` is renamed to `.engine` and
now accepts a `VoxelEngine` directly.
