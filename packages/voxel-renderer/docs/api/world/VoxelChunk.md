# VoxelChunk

Fixed-size, sparse 3D grid of voxel data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space**. Multiply by `chunkSize` to get the world-space origin.

```ts
const DEFAULT_CHUNK_SIZE = 16;
```

## Storage

Voxels are stored as packed 32-bit integers in a [`VoxelStore`](./VoxelStore.md), not as
`{ blockId, transform }` objects. Keys and values live in typed arrays, avoiding one
heap object per stored voxel.

Two consequences for callers:

- `get()`, `getAt()` and `entries()` **rebuild** a `VoxelEntry` on each call. They no
  longer return the object that was written, so compare with a deep equality check,
  never `===`.
- Block ids must fit in 23 bits (`1..MAX_BLOCK_ID`, 8 388 607). `packVoxel()` throws a
  `RangeError` above that rather than truncating silently, and on id `0`, which is
  air and has no packed form (see [air](../blocks/BlockDefinition.md#air)).

The `Packed` variants below skip the object entirely and are what the mesh builders
use.

### Packed voxel values

Chunks encode a block ID and transform byte in one non-negative 32-bit integer.

```ts
type PackedVoxel = number;

const MAX_BLOCK_ID: number; // 8_388_607
const VOXEL_ABSENT: number; // -1

function packVoxel(
  blockId: number,
  transform: number
): PackedVoxel;

function unpackVoxel(packed: PackedVoxel): VoxelEntry;
function voxelBlockId(packed: PackedVoxel): number;
function voxelTransform(packed: PackedVoxel): number;
```

`packVoxel()` stores the transform in bits 0 through 7 and the block ID in bits
8 through 30. It throws `RangeError` for air (`0`), a negative ID, or an ID
greater than `MAX_BLOCK_ID`.

`VOXEL_ABSENT` is returned by packed read methods when no voxel exists. Every
stored `PackedVoxel` is non-negative, so `packed < 0` is a valid absence check.

## Constructor

```ts
new VoxelChunk(
  [cx, cy, cz]: [number, number, number],
  size?: number
)
```

> [!NOTE]
> Chunk has a default size of 16. `size` must be a power of two because
> `linearIndex()` composes the three local coordinates into disjoint bit fields.
> Anything else throws a `RangeError`.

## Properties

```ts
class VoxelChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;

  // side length in voxels, always a power of two
  readonly size: number;
  // log2(size) and size - 1, for callers doing their own index math
  readonly shift: number;
  readonly mask: number;

  // set true on any write; cleared by VoxelEngine when the chunk is queued
  // for rebuild, so an edit during the rebuild is not swallowed
  dirty: boolean;

  readonly voxelCount: number;

  // low-level backing storage; prefer the chunk accessors
  readonly store: VoxelStore;
}
```

## Methods

```ts
type VoxelLinearCoords = [number, number, number];
```

### `get(coords: VoxelLinearCoords): VoxelEntry | undefined`

### `getAt(lx: number, ly: number, lz: number): VoxelEntry | undefined`

Same lookup as `get()` without the tuple.

### `getPackedAt(lx: number, ly: number, lz: number): PackedVoxel`

Allocation-free lookup returning the packed integer, or `VOXEL_ABSENT` (`-1`) when the
position is empty. This is what the mesh builder calls once per voxel face.

### `set(coords: VoxelLinearCoords, entry: VoxelEntry): void`

### `setPackedAt(lx: number, ly: number, lz: number, packed: PackedVoxel): void`

### `mayContain(lx: number, ly: number, lz: number): boolean`

`false` when the position is provably empty, using a conservative bounding box
of every written voxel. A `true` result still needs a `getAt()` to confirm.
The box only grows. `delete()` never shrinks it, so the result stays valid at
the cost of becoming loose after erasures.

### `delete(coords: VoxelLinearCoords): boolean`

Removes the voxel and returns `true`; returns `false` when the position was already
empty.

### `isEmpty(): boolean`

### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs. Allocates a tuple and
an entry object per voxel.

### `packedEntries(): IterableIterator<[number, PackedVoxel]>`

Same walk, yielding the packed integer instead of an entry object.

### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat key used for sparse storage.

### `fromLinearIndex(idx: number): { lx: number; ly: number; lz: number }`

Inverse of `linearIndex`.

### `toString(): string`

Returns the chunk key as `"cx,cy,cz"`.

The low-level sparse backing store has a separate
[`VoxelStore`](./VoxelStore.md) reference.
