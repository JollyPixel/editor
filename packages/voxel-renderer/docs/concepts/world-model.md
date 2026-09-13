# World model

A `VoxelWorld` contains named `VoxelLayer` instances. Each layer divides its
voxel data into fixed-size `VoxelChunk` instances and stores placed objects in
separate object layers.

```text
VoxelWorld
  +-- VoxelLayer
  |     +-- VoxelChunk
  |           +-- VoxelStore
  +-- VoxelObjectLayerJSON
```

## Layer compositing

Voxel layers are evaluated from the highest `order` to the lowest. World reads
return the first visible layer with `opacity > 0` and a stored voxel at the
requested position.

Mesh generation also uses each layer's `compositing` policy. The default
`"composite"` suppresses a lower voxel only when the higher layer has opacity
`1` and its block has opaque geometry covering all six cell boundaries. Glass,
cutout blocks, and partial shapes preserve the lower voxel. `"replace"`
suppresses lower voxels for any occupied cell in a layer at opacity `1`.
Both policies preserve lower voxels when the higher layer is faded.

An opacity below `1` also scopes face occlusion to the layer itself during mesh
generation. Its voxels cull only faces in that same layer and do not hide
neighbouring faces in other layers. Interior faces in the partially opaque
layer are still culled because drawing coincident blended faces produces a
checkerboard through the volume. An opacity of `0` behaves like
`visible = false`. Collision is unchanged for partially transparent layers and
removed only when the layer is hidden.

## Coordinates and positions

Chunk coordinates identify a chunk. Layer-local coordinates identify cells in
a layer. Public world and layer voxel methods accept world-space positions and
convert them through the layer position.

A layer position is the world-space location of its local origin. It translates
every voxel without changing chunk storage. Use `VoxelWorld.setLayerPosition()`
or `translateLayer()` so the world recalculates cross-layer face culling.

`VoxelLayer.localToWorld()` and `worldToLocal()` convert coordinates explicitly.
`localBounds()`, `worldBounds()`, and `worldCenter()` describe the content rather
than the origin. `VoxelWorld.rebaseLayer()` moves the origin and rewrites local
storage so content remains at the same world positions.

## Ownership

`VoxelWorld` owns layer ordering and composited reads. `VoxelLayer` owns chunks
and direct reads or writes for one layer. `VoxelChunk` owns the fixed-size grid,
and `VoxelStore` owns its sparse packed values.

Application edits go through `VoxelWorld`, which emits the
[hook events](../api/core/hooks.md) and marks the chunks it touched dirty;
[`VoxelEngine`](../api/core/VoxelEngine.md) picks those up to update rendering
and collision. A world used on its own, with no engine around it, is what a
headless server or an offline tool runs.
