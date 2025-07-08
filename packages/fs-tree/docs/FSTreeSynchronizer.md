# FSTreeSynchronizer

Synchronizes an `FSTree` instance with the actual file system, ensuring consistency between the in-memory tree and disk.

## Signature

```typescript
class FSTreeSynchronizer {
  constructor(tree: FSTree, options?: FSTreeSynchronizerOptions);

  async synchronize(): Promise<void>;
  async close(): Promise<void>;
}
```

## Usage example

```typescript
import { FSTree, FSTreeSynchronizer } from "@jolly-pixel/fs-tree";

const tree = await FSTree.loadFromPath(process.cwd());
{
  await using synchronizer = new FSTreeSynchronizer(tree);

  // Perform some operations on the tree (e.g., delete a directory)
  tree.rmdir("/foobar");
}

// directory is deleted from FS
```

## Methods

### constructor(tree: FSTree, options: FSTreeSynchronizerOptions = {})

Creates a new `FSTreeSynchronizer` instance, associating it with a specific `FSTree` to monitor and synchronize its changes.

### async synchronize(): Promise<void>

Asynchronously synchronizes all pending operations (e.g., file creations, deletions, moves) from the `FSTree` instance to the underlying file system. This method ensures that the disk state reflects the in-memory tree state.

### async close(): Promise<void>

Asynchronously stops the synchronization process and releases any resources held by the synchronizer, such as file handles or watchers. It's important to call this method when the synchronizer is no longer needed to prevent resource leaks.
