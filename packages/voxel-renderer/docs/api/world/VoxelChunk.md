# VoxelChunk

A cube of `size³` voxel cells inside a [`VoxelLayer`](./VoxelLayer.md). Custom
[colliders](../collision/VoxelCollider.md) receive chunks in
`VoxelChunkCollision.chunks`; other code reads voxels through
[`VoxelWorld`](./VoxelWorld.md).

```ts
const collider: VoxelCollider = {
  rebuildChunk(key, { origin, chunks }) {
    for (const chunk of chunks) {
      for (const [index, packed] of chunk.packedEntries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(index);
        const blockId = voxelBlockId(packed);
        // cell at origin + (lx, ly, lz)
      }
    }
  },
  removeChunk(key) {},
  dispose() {}
};
```

## Coordinates

`cx`, `cy` and `cz` are chunk coordinates in the layer. Multiplied by `size`
they give the chunk origin in layer-local space; add `layer.position` for world
space. Methods take local coordinates `lx`, `ly`, `lz` in `0..size - 1`.

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `cx`, `cy`, `cz` | `number` | Chunk coordinates. |
| `size` | `number` | Side length in voxels, a power of two. Default `DEFAULT_CHUNK_SIZE` (16). |
| `voxelCount` | `number` | Stored voxels. |

## Methods

#### `getAt(lx: number, ly: number, lz: number): VoxelEntry | undefined`

The voxel at a local position, or `undefined` for air. Each call returns a new
object, so compare entries by value.

#### `getPackedAt(lx: number, ly: number, lz: number): PackedVoxel`

Same lookup without allocating. Returns `VOXEL_ABSENT` for air.

#### `entries(): IterableIterator<[number, VoxelEntry]>`

#### `packedEntries(): IterableIterator<[number, PackedVoxel]>`

Every stored voxel with its linear index.

#### `fromLinearIndex(index: number): { lx: number; ly: number; lz: number }`

#### `linearIndex(lx: number, ly: number, lz: number): number`

Convert between local coordinates and the linear index the iterators yield.

#### `countBlocks(): ReadonlyMap<number, number>`

Voxel count per block id. Do not mutate the returned map.

#### `isEmpty(): boolean`

## Packed voxels

Packed reads return a block id and a transform byte in one non-negative
integer.

```ts
type PackedVoxel = number;

const VOXEL_ABSENT = -1;
const MAX_BLOCK_ID = 8_388_607;
const DEFAULT_CHUNK_SIZE = 16;

function packVoxel(blockId: number, transform: number): PackedVoxel;
function unpackVoxel(packed: PackedVoxel): VoxelEntry;
function voxelBlockId(packed: PackedVoxel): number;
function voxelTransform(packed: PackedVoxel): number;
```

`packVoxel()` throws a `RangeError` for air (`0`), a negative id, or an id
above `MAX_BLOCK_ID`. Any packed value below zero means no voxel. Decode the
transform byte with [`VoxelTransform`](./VoxelTransform.md).
