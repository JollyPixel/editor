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

Mesh generation applies an additional opacity rule. A voxel in a fully opaque
layer hides lower-priority voxels at the same world position. A voxel in a
partially opaque layer is drawn with the voxels below it, so a decorative layer
can cover base terrain without modifying it.

An opacity below `1` also scopes face occlusion to the layer itself during mesh
generation. Its voxels cull only faces in that same layer and do not hide
neighbouring faces in other layers. Interior faces in the partially opaque
layer are still culled because drawing coincident blended faces produces a
checkerboard through the volume. An opacity of `0` behaves like
`visible = false`. Collision is unchanged for partially transparent layers and
removed only when the layer is hidden.

## Coordinates and offsets

Chunk coordinates identify a chunk. Local coordinates identify a cell inside
that chunk. Public world and layer methods accept world-space positions.

A layer offset translates every voxel without changing its chunk storage. Use
`VoxelWorld.setLayerOffset()` or `translateLayer()` so the world marks affected
chunks dirty and recalculates cross-layer face culling.

## Ownership

`VoxelWorld` owns layer ordering and composited reads. `VoxelLayer` owns chunks
and direct reads or writes for one layer. `VoxelChunk` owns the fixed-size grid,
and `VoxelStore` owns its sparse packed values.

Application edits go through `VoxelWorld`, which emits the
[hook events](../api/core/hooks.md) and marks the chunks it touched dirty;
[`VoxelEngine`](../api/core/VoxelEngine.md) picks those up to update rendering
and collision. A world used on its own, with no engine around it, is what a
headless server or an offline tool runs.
