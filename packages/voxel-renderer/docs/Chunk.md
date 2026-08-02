# VoxelChunk

Fixed-size, sparse 3D grid of `VoxelEntry` data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space** — multiply by `chunkSize` to get the world-space origin.

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
}
```

## Methods

```ts
type VoxelLinearCoords = [number, number, number];
```

### `get(coords: VoxelLinearCoords): VoxelEntry | undefined`

### `getAt(lx: number, ly: number, lz: number): VoxelEntry | undefined`

Same lookup as `get()` without the tuple, for hot paths that would otherwise
allocate an array per call (the mesh builder does one lookup per voxel face).

### `set(coords: VoxelLinearCoords, entry: VoxelEntry): void`

### `mayContain(lx: number, ly: number, lz: number): boolean`

`false` when the position is provably empty, using a conservative bounding box
of every written voxel. A `true` result still needs a `getAt()` to confirm.
The box only ever grows — `delete()` never shrinks it — so it stays valid at
the cost of being loose after erasures.

### `delete(coords: VoxelLinearCoords): void`

### `isEmpty(): boolean`

### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs.

### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat map key used for sparse storage.

### `fromLinearIndex(idx: number): [number, number, number]`

Inverse of `linearIndex`.
