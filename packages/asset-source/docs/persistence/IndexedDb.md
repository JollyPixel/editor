# IndexedDB persistence

`IndexedDbAssetSource` keeps assets in the browser, in a `files` object store
keyed by asset path and a `folders` store keyed by folder path. It survives a
page reload.

```ts
import { IndexedDbAssetSource } from "@jolly-pixel/asset-source";

const source = await IndexedDbAssetSource.open({
  name: "jolly-workspace:default"
});

await source.write("textures/grass.png", bytes);
source.close();
```

The source is exported from the package root. It only reaches the `indexedDB`
global when `open()` or `destroy()` runs, so loading the root in Node.js is
safe.

```ts
IndexedDbAssetSource.open(options): Promise<IndexedDbAssetSource>
IndexedDbAssetSource.destroy(options): Promise<void>
source.close(): void
```

| Option | Default | Description |
|---|---|---|
| `name` | required | Database name. Two sources opened on one name share their assets. |
| `factory` | `globalThis.indexedDB` | The `IDBFactory` to open the database with. |

- A write resolves once its transaction completed. A failed transaction
  rejects the write with the IndexedDB error, `QuotaExceededError` included.
- `write` and `writeIfAbsent` copy their input bytes, and `read` returns a
  copy.
- `list()` leaves out the `.jollypixel/` state files, which stay readable.
- A database created before the `folders` store is upgraded when opened, and
  the folders of the files it already held are stored then.
- `destroy` deletes the database. It waits for every open connection, so
  `close()` the source first.

The source implements the shared [`AssetSource`](../../README.md#assetsource) storage
contract. It does not provide `isIgnored` or `watch`.
