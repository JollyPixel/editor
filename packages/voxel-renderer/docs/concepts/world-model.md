# World model

A [`VoxelWorld`](../api/world/VoxelWorld.md) holds a stack of named voxel
layers, a set of object layers for placed objects such as spawn points, and
[voxel templates](../api/world/VoxelTemplates.md), which are saved with the
world but never drawn. Each voxel layer stores its voxels in fixed-size
chunks.

```text
VoxelWorld
  +-- VoxelLayer (stacked)
  |     +-- VoxelChunk
  +-- object layers
  +-- VoxelTemplate
```

A [`VoxelDocument`](../api/core/VoxelDocument.md) wraps the world with the
block registry, the blockset declarations and the undo history. It is
everything a peer synchronizes, and runs without a view on a server or in a
tool.

## Layer compositing

Layers are sorted by `rank`; `order` is a layer's position in that stack,
higher on top. World reads return the voxel of the highest visible layer that
has one at the position.

Meshing also follows each layer's `compositing` policy. The default,
`"composite"`, hides a lower voxel only when the block above has opaque
geometry covering all six sides of the cell, so glass, cutout blocks and
partial shapes let the lower voxel show. `"replace"` hides lower voxels under
any occupied cell.

A hidden layer is left out of reads, meshing and collision. Transparency is a
property of blocks, not layers: see `alphaMode` on
[`BlockSurface`](../api/blocks/BlockSurface.md).

## Coordinates and positions

World and layer voxel methods take world-space positions. A layer's position
is the world-space location of its local origin; moving it translates every
voxel without rewriting them. Use `VoxelWorld.setLayerPosition()` or
`translateLayer()` so neighbouring layers re-cull their faces.

`VoxelLayer.localToWorld()` and `worldToLocal()` convert between the two.
`localBounds()`, `worldBounds()` and `worldCenter()` describe the layer's
content rather than its origin. `VoxelWorld.rebaseLayer()` moves the origin
while keeping the content in place, and `transformLayer()` turns or mirrors
the content around its center; a layer stores no rotation of its own.

## Editing

Edit through `VoxelWorld`. Its methods emit
[layer commands](../api/core/commands.md) and mark the touched chunks dirty,
and a [`VoxelView`](../api/core/VoxelView.md) picks the changes up for
rendering and collision. Writes made directly on a `VoxelLayer` emit nothing
and are not recorded in the history.
