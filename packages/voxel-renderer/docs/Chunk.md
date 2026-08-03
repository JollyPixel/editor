# VoxelChunk

Fixed-size, sparse 3D grid of voxel data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space** — multiply by `chunkSize` to get the world-space origin.

## Storage

Voxels are stored as packed 32-bit integers in a [`VoxelStore`](#voxelstore), not as
`{ blockId, transform }` objects. A `Map<number, VoxelEntry>` costs ~87 bytes of JS
heap per voxel; the packed form costs ~11 bytes, lives in typed arrays outside the
heap, and is invisible to the garbage collector.

Two consequences for callers:

- `get()`, `getAt()` and `entries()` **rebuild** a `VoxelEntry` on each call. They no
  longer return the object that was written, so compare with a deep equality check,
  never `===`.
- Block ids must fit in 23 bits (`0..MAX_BLOCK_ID`, 8 388 607). `packVoxel()` throws a
  `RangeError` above that rather than truncating silently.

The `Packed` variants below skip the object entirely and are what the mesh builders
use.

## Constructor

```ts
new VoxelChunk(
  [cx, cy, cz]: [number, number, number],
  size?: number
)
```

> [!NOTE]
> Chunk has a default size of 16

## Properties

```ts
class VoxelChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;

  // side length in voxels
  readonly size: number;

  // set true on any write; cleared by VoxelEngine after mesh rebuild
  dirty: boolean;

  readonly voxelCount: number;

  // backing storage; not part of the stable API
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
The box only ever grows — `delete()` never shrinks it — so it stays valid at
the cost of being loose after erasures.

### `delete(coords: VoxelLinearCoords): void`

### `isEmpty(): boolean`

### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs. Allocates a tuple and
an entry object per voxel.

### `packedEntries(): IterableIterator<[number, PackedVoxel]>`

Same walk, yielding the packed integer instead of an entry object.

### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat key used for sparse storage.

### `fromLinearIndex(idx: number): [number, number, number]`

Inverse of `linearIndex`.

## Packed voxels

```ts
type PackedVoxel = number;

// blockId in bits 8-30, transform in bits 0-7
function packVoxel(blockId: number, transform: number): PackedVoxel;
function unpackVoxel(packed: PackedVoxel): VoxelEntry;
function voxelBlockId(packed: PackedVoxel): number;
function voxelTransform(packed: PackedVoxel): number;

const MAX_BLOCK_ID: number;  // 8_388_607
const VOXEL_ABSENT: number;  // -1
```

Every real `PackedVoxel` is non-negative, so `packed < 0` is the absence test.

## VoxelStore

Sparse `linearIndex → PackedVoxel` map backed by an `Int32Array` of keys and a
`Uint32Array` of values, open-addressed with linear probing and grown at a 3/4 load
factor. Deletion shifts the following cluster back (Knuth 6.4 algorithm R) instead of
leaving tombstones, so a chunk that is repeatedly painted and erased never degrades.

```ts
class VoxelStore {
  readonly size: number;
  // slot count to walk when iterating; keys/values are replaced on growth
  readonly capacity: number;
  readonly keys: Int32Array;
  readonly values: Uint32Array;

  get(key: number): PackedVoxel;   // VOXEL_ABSENT when missing
  has(key: number): boolean;
  set(key: number, value: PackedVoxel): boolean;  // true when the key was new
  delete(key: number): boolean;
  clear(): void;
}
```

`keys` and `values` are exposed so a hot loop can sweep a chunk without the per-voxel
allocation an iterator forces. Slots holding a voxel are those where `keys[slot] >= 0`:

```ts
const { keys, values, capacity } = chunk.store;

for (let slot = 0; slot < capacity; slot++) {
  const linearIndex = keys[slot];
  if (linearIndex < 0) {
    continue;
  }
  const blockId = voxelBlockId(values[slot]);
}
```
