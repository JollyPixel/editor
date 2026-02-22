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

  // set true on any write; cleared by VoxelRenderer after mesh rebuild
  dirty: boolean;

  readonly voxelCount: number;
}
```

## Methods

```ts
type VoxelLinearCoords = [number, number, number];
```

### `get(coords: VoxelLinearCoords): VoxelEntry | undefined`

### `set(coords: VoxelLinearCoords, entry: VoxelEntry): void`

### `delete(coords: VoxelLinearCoords): void`

### `isEmpty(): boolean`

### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs.

### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat map key used for sparse storage.

### `fromLinearIndex(idx: number): [number, number, number]`

Inverse of `linearIndex`.
