# World model

A `VoxelWorld` contains named `VoxelLayer` instances. Each layer divides its
voxel data into fixed-size `VoxelChunk` instances and stores placed objects in
separate object layers. [Voxel templates](../api/world/VoxelTemplates.md) are
saved with the world outside the layer stack and never drawn.

```text
VoxelWorld
  +-- VoxelLayer
  |     +-- VoxelChunk
  |           +-- VoxelStore
  +-- VoxelObjectLayerJSON
  +-- VoxelTemplate
```

## Layer compositing

Voxel layers are evaluated from the highest `order` to the lowest. World reads
return the first visible layer with a stored voxel at the requested position.

Mesh generation also uses each layer's `compositing` policy. The default
`"composite"` suppresses a lower voxel only when the higher layer's block has
opaque geometry covering all six cell boundaries. Glass, cutout blocks, and
partial shapes preserve the lower voxel. `"replace"` suppresses lower voxels
for any occupied cell.

A hidden layer is left out of world reads, meshing, and collision.
Translucency belongs to blocks: see `alphaMode` in
[BlockSurface](../api/blocks/BlockSurface.md).

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
[layer commands](../api/core/commands.md) and marks the chunks it touched dirty;
[`VoxelView`](../api/core/VoxelView.md) picks those up to update rendering and
collision.

One level up, [`VoxelDocument`](../api/core/VoxelDocument.md) wraps the world
with the block registry, the tileset declarations and the history, and is the
whole of what a peer synchronizes. A document with no view attached is what a
headless server or an offline tool runs.
