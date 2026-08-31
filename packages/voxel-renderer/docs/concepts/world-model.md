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

Voxel layers are composited from the highest `order` to the lowest. At one world
position, the first visible layer with `opacity > 0` and a stored voxel wins.
This lets a decorative layer replace base terrain without modifying it.

An opacity below `1` stops the layer from occluding neighbouring faces during
mesh generation. An opacity of `0` behaves like `visible = false`. Collision is
unchanged for partially transparent layers and removed only when the layer is
hidden.

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

Use [`VoxelEngine`](../api/core/VoxelEngine.md) for application edits that must
also update rendering, collision, and hooks. The lower-level world classes are
useful for headless processing and integrations.
