# BlockShapeRegistry

`BlockShapeRegistry` maps shape IDs to implementations. `VoxelEngine` creates a
registry containing all [built-in shapes](./built-in-shapes.md).

## API

```ts
class BlockShapeRegistry implements Iterable<BlockShape> {
  readonly version: number;

  register(shape: BlockShape): this;
  get(id: BlockShapeID): BlockShape | undefined;
  has(id: BlockShapeID): boolean;
  getAll(): IterableIterator<BlockShape>;
  ids(): IterableIterator<BlockShapeID>;
  [Symbol.iterator](): IterableIterator<BlockShape>;

  static createDefault(): BlockShapeRegistry;
}
```

Iteration preserves registration order. `version` increments on each
registration so mesh caches can detect a changed shape. `createDefault()`
returns a standalone registry with the built-in implementations already
registered.
