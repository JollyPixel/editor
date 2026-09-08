# In-memory persistence

`MemoryAssetSource` keeps assets in one source instance. It is useful for tests
and in-process workflows that do not need filesystem storage.

```ts
new MemoryAssetSource(
  files?: Iterable<readonly [string, Uint8Array]>
)
```

```ts
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

const source = new MemoryAssetSource([
  ["textures/grass.png", new Uint8Array([1, 2, 3])]
]);
```

The constructor and `write` copy their input bytes. `read` also returns a copy,
so changing a supplied or returned array does not change the stored asset.
Each source has its own data.

The source implements the shared [`AssetSource`](./AssetSource.md) storage
contract. It does not provide `isIgnored` or `watch`.
