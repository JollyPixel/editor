# IndexedDB persistence

`IndexedDbAssetSource` keeps assets in the browser, in a `files` object store
keyed by asset path and a `folders` store keyed by folder path. It survives a
page reload.

```ts
import { IndexedDbAssetSource } from "@jolly-pixel/asset-source";

const source = await IndexedDbAssetSource.open({
  name: "jolly-offline:default"
});

await source.write("textures/grass.png", bytes);
source.close();
```

The source is exported from the package root. It only reaches the `indexedDB`
global when `open()` or `destroy()` runs, so loading the root in Node.js is
safe. Node.js tests can install the IndexedDB globals with
`fake-indexeddb/auto`.

```ts
IndexedDbAssetSource.open(options): Promise<IndexedDbAssetSource>
IndexedDbAssetSource.destroy(options): Promise<void>
source.close(): void

interface IndexedDbAssetSourceOptions {
  name: string;
}
```

`name` is the database name. Two sources opened on one name share their
assets.

- A write resolves once its transaction completed. A failed transaction
  rejects the write with the IndexedDB error, `QuotaExceededError` included.
- `write` and `writeIfAbsent` copy their input bytes, and `read` returns a
  copy.
- `list()` leaves out the `.jollypixel/` state files, which stay readable.
- `destroy` deletes the database. A source still open on it closes its
  connection first, then rejects its next call.

The source implements the shared [`AssetSource`](../../README.md#assetsource) storage
contract. `isIgnored` matches the `.jollypixel/` state directory only, and
the source does not provide `watch`.
