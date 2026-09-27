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
  readonly shared: boolean;

  static fromArrays(keys: Int32Array, values: Uint32Array, size: number): VoxelStore;

  constructor(initialCapacity?: number);
  get(key: number): PackedVoxel;
  has(key: number): boolean;
  set(key: number, value: PackedVoxel): boolean;
  delete(key: number): boolean;
  clear(): void;
  copyFrom(source: VoxelStore): void;
  reserve(size: number): void;
  share(): void;
}
```

`initialCapacity` defaults to `16` and is rounded up to a power of two, with a
minimum capacity of `16`.

`get()` returns `VOXEL_ABSENT` when the key is missing. `set()` returns `true`
when it inserts a new key and `false` when it replaces an existing value.

The store grows at a three-quarter load factor. Deletion shifts the following
probe cluster back instead of leaving tombstones.

`copyFrom()` replaces this store's content with the source's, discarding
whatever it held. Capacity is matched to the source, so the slots are copied
verbatim and the probe clusters stay valid without rehashing. The copy owns its
arrays and can be written to and grown independently.

`reserve()` grows the table once so `size` entries fit without another rehash.
It never shrinks the store.

## Shared memory

`share()` moves `keys` and `values` into `SharedArrayBuffer`s, and every array
the store allocates afterwards (growth, `copyFrom()`) stays shared. It is a
no-op once `shared` is `true`. The view calls it on the chunks a
[mesh worker](../core/VoxelEngine.md#mesh-workers) reads.

`fromArrays()` wraps existing arrays without copying them. The arrays must have
the same power-of-two length of at least `16`, otherwise it throws a
`RangeError`. A worker uses it to read a store it received; writes made by the
owner stay visible until the owner grows the store and replaces its arrays.

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
