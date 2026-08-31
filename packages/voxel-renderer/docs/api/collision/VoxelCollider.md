# VoxelCollider

`VoxelCollider` is the contract between `VoxelEngine` and a physics backend.
Collision is disabled unless `VoxelEngineOptions.collider` supplies a factory.

## API

```ts
interface VoxelChunkCollision {
  chunk: VoxelChunk;
  geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  layerOffset: VoxelCoord;
}

interface VoxelCollider {
  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void;
  removeChunk(key: string): void;
  dispose(): void;
}

interface VoxelColliderContext {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

type VoxelColliderFactory = (
  context: VoxelColliderContext
) => VoxelCollider;
```

`rebuildChunk()` replaces any collider registered under `key`.
`removeChunk()` is a no-op for an unknown key. Implementations own their physics
handles and release all remaining resources from `dispose()`.

The geometry map follows renderer draw groups and is split by tileset and
cutout mode. Treat its string keys as opaque.

## Geometry merging

```ts
interface MergedChunkGeometry {
  geometry: THREE.BufferGeometry;
  owned: boolean;
}

function mergeChunkGeometries(
  geometries: ReadonlyMap<string, THREE.BufferGeometry>
): MergedChunkGeometry | null;
```

The function returns `null` when there is no collision geometry. Dispose the
returned geometry only when `owned` is `true`.

## Collision strategy

Each block shape supplies one collision hint:

- `"box"` creates one unit cuboid per solid voxel.
- `"trimesh"` uses the chunk's rendered triangles.
- `"none"` excludes the block from collision.

If any block in a chunk requests `"trimesh"`, the complete chunk uses one
triangle mesh. It falls back to cuboids when no triangle geometry is available.

Layer opacity does not affect collision until it reaches `0`, which behaves as
a hidden layer and removes its colliders.

See [adding physics](../../guides/adding-physics.md) for setup with the bundled
Rapier implementation.
