# VoxelCollider

`VoxelCollider` is the contract between `VoxelEngine` and a physics backend.
Collision is disabled unless `VoxelEngineOptions.collider` supplies a factory.

## API

```ts
interface VoxelChunkCollision {
  origin: VoxelCoord;
  chunks: readonly VoxelChunk[];
  geometries: ReadonlyMap<ChunkGeometryKey, THREE.BufferGeometry>;
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

`rebuildChunk()` runs whenever the view meshes a key, including one that
draws no face; the map is then empty. A key covers one chunk cell: `chunks`
holds the layer chunks drawn there, highest compositing priority first, and
every one of them starts at the world-space `origin`. Layers at opacity `1`
on the chunk grid share a key; a faded layer or one off the chunk grid gets a
key of its own with a single chunk. Voxels hidden by a higher layer stay in
their chunk, so a collider sees them too.

The map follows renderer draw groups, keyed by `ChunkGeometryKey` (`tilesetId`
and `surface`). Vertex positions are relative to `origin`, and each geometry
owns its index attribute while sharing CPU index storage. Respect the
geometry's draw range when reading indices.

## Geometry merging

```ts
interface MergedChunkGeometry {
  geometry: THREE.BufferGeometry;
  owned: boolean;
}

function mergeChunkGeometries(
  geometries: ReadonlyMap<ChunkGeometryKey, THREE.BufferGeometry>
): MergedChunkGeometry | null;

function drawnIndices(
  geometry: THREE.BufferGeometry
): THREE.TypedArray | null;
```

The function returns `null` when there is no collision geometry. Dispose the
returned geometry only when `owned` is `true`. Merging keeps only the
indices inside each draw range; `drawnIndices()` returns that range for a
single geometry.

## Collision strategy

Each block shape supplies one collision hint:

- `"box"` creates a cuboid sized to the shape's transformed bounds; full
  cubes are greedily merged into as few cuboids as possible.
- `"trimesh"` adds the shape's faces to one triangle mesh per chunk.
- `"none"` excludes the block from collision.

Blocks with `collidable: false` are skipped whatever their hint.

Layer opacity does not affect collision until it reaches `0`, which behaves as
a hidden layer and removes its colliders.

See [adding physics](../../guides/adding-physics.md) for setup with the bundled
Rapier implementation.
