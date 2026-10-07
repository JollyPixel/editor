# VoxelChunk

A cube of `size³` voxel cells inside a [`VoxelLayer`](./VoxelLayer.md). Custom
[colliders](../collision/VoxelCollider.md) receive chunks in
`VoxelChunkCollision.chunks`; other code reads voxels through
[`VoxelWorld`](./VoxelWorld.md).

```ts
const collider: VoxelCollider = {
  rebuildChunk(key, { origin, chunks }) {
    for (const chunk of chunks) {
      for (const [index, packed, partner] of chunk.packedEntries()) {
        const { lx, ly, lz } = chunk.fromLinearIndex(index);
        const blockId = voxelBlockId(packed);
        // cell at origin + (lx, ly, lz); partner is VOXEL_ABSENT unless merged
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
| `voxelCount` | `number` | Stored cells; a merged cell counts once. |

## Methods

#### `getAt(lx: number, ly: number, lz: number): VoxelEntry | undefined`

The voxel at a local position, or `undefined` for air. Each call returns a new
object, so compare entries by value.

#### `getPackedAt(lx: number, ly: number, lz: number): PackedVoxel`

#### `getPartnerAt(lx: number, ly: number, lz: number): PackedVoxel`

Same lookup without allocating, for the first and the second shape of a
[merged cell](./VoxelWorld.md#merged-cells). Return `VOXEL_ABSENT` for air,
and `getPartnerAt()` also for a cell that is not merged. Both return values
as `packVoxel()` builds them.

#### `storedAt(lx: number, ly: number, lz: number): PackedVoxel`

The raw stored value, as `store.values` holds it. On a merged cell it carries a
flag bit, so it differs from `packVoxel()` of the same block and transform;
decode it with `voxelBlockId()` and `voxelTransform()`. Meant for meshing hot
paths; prefer `getPackedAt()` elsewhere.

#### `entries(): IterableIterator<[number, VoxelEntry]>`

#### `packedEntries(): IterableIterator<[number, PackedVoxel, PackedVoxel]>`

Every stored cell with its linear index. `packedEntries()` yields the first
shape as `packVoxel()` builds it, then the second shape or `VOXEL_ABSENT`.

#### `fromLinearIndex(index: number): { lx: number; ly: number; lz: number }`

#### `linearIndex(lx: number, ly: number, lz: number): number`

Convert between local coordinates and the linear index the iterators yield.

#### `countBlocks(): ReadonlyMap<number, number>`

Voxel count per block id, counting both shapes of a merged cell. Do not
mutate the returned map.

#### `contentBounds(): VoxelChunkBounds | null`

Inclusive local corners of the stored voxels, or `null` for an empty chunk.
The result is frozen and cached until the chunk changes, so
`VoxelLayer.localBounds()` only rescans edited chunks.

```ts
interface VoxelChunkBounds {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}
```

#### `isEmpty(): boolean`

## Packed voxels

Packed reads return a block id and a transform in one non-negative integer.

```ts
type PackedVoxel = number;

const VOXEL_ABSENT = -1;
const MAX_BLOCK_ID = 8_388_607;
const DEFAULT_CHUNK_SIZE = 16;

function packVoxel(blockId: number, transform: number): PackedVoxel;
function unpackVoxel(packed: PackedVoxel): VoxelEntry;
function voxelBlockId(packed: PackedVoxel): number;
function voxelTransform(packed: PackedVoxel): number;
function turnVoxel(packed: PackedVoxel, transform: VoxelTransform): PackedVoxel;
```

`packVoxel()` throws a `RangeError` for air (`0`), a negative id, or an id
above `MAX_BLOCK_ID`, and keeps only the bits of a packed
[`VoxelTransform`](./VoxelTransform.md). Any packed value below zero means no
voxel. `turnVoxel()` applies `transform` after the voxel's own, and returns
`VOXEL_ABSENT` unchanged.
