# VoxelStore

`VoxelStore` is the sparse `linearIndex` to `PackedVoxel` map used by
[`VoxelChunk`](./VoxelChunk.md). It uses typed arrays, open addressing, and
linear probing.

## API

```ts
class VoxelStore {
  readonly size: number;
  readonly capacity: number;
  readonly keys: Int32Array;
  readonly values: Uint32Array;

  constructor(initialCapacity?: number);
  get(key: number): PackedVoxel;
  has(key: number): boolean;
  set(key: number, value: PackedVoxel): boolean;
  delete(key: number): boolean;
  clear(): void;
}
```

`initialCapacity` defaults to `16` and is rounded up to a power of two, with a
minimum capacity of `16`.

`get()` returns `VOXEL_ABSENT` when the key is missing. `set()` returns `true`
when it inserts a new key and `false` when it replaces an existing value.

The store grows at a three-quarter load factor. Deletion shifts the following
probe cluster back instead of leaving tombstones.

## Direct iteration

`keys` and `values` are exposed for hot loops that must avoid iterator and object
allocation. Their arrays are replaced when the store grows. Slots containing a
voxel have a non-negative key.

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
