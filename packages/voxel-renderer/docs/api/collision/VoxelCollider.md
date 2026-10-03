# VoxelCollider

The interface between a [`VoxelView`](../core/VoxelView.md) and a physics
engine. Collision is off unless `VoxelViewOptions.collider` provides a
factory. [`RapierVoxelCollider`](./RapierVoxelCollider.md) is the bundled
implementation; see [adding physics](../../guides/adding-physics.md).

## API

```ts
type VoxelColliderFactory = (context: VoxelColliderContext) => VoxelCollider;

interface VoxelColliderContext {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

interface VoxelCollider {
  rebuildChunk(key: string, collision: VoxelChunkCollision): void;
  removeChunk(key: string): void;
  dispose(): void;
}

interface VoxelChunkCollision {
  origin: VoxelCoord;
  chunks: readonly VoxelChunk[];
  geometries: ReadonlyMap<ChunkGeometryKey, THREE.BufferGeometry>;
}
```

The view calls the factory once, with `document.blocks` and `view.shapes`.

- `rebuildChunk()` runs each time the view meshes a chunk cell, and replaces
  whatever was registered under `key`. Keys are opaque.
- `removeChunk()` ignores an unknown key.
- `dispose()` releases every remaining physics object.

`VoxelChunkCollision` describes one chunk cell:

- `origin` is the world-space corner of the cell.
- `chunks` are the [layer chunks](../world/VoxelChunk.md) drawn there, highest
  layer first. Voxels covered by a higher layer are still in them.
- `geometries` holds the rendered geometry per draw group, with positions
  relative to `origin`. It is empty when the cell draws nothing. Read indices
  within each geometry's draw range.

Hiding a layer removes its colliders. Blocks with `collidable: false` should be
skipped; each [block shape](../blocks/BlockShape.md) also declares a
`collisionHint`.

## Geometry helpers

```ts
function mergeChunkGeometries(
  geometries: ReadonlyMap<ChunkGeometryKey, THREE.BufferGeometry>
): { geometry: THREE.BufferGeometry; owned: boolean } | null;

function drawnIndices(geometry: THREE.BufferGeometry): THREE.TypedArray | null;
```

`mergeChunkGeometries()` merges the draw groups of a cell into one geometry, or
returns `null` when there is none. Dispose the result only when `owned` is
`true`. `drawnIndices()` returns the indices inside one geometry's draw range.
