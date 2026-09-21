# IndexedDB persistence

`IndexedDbAssetSource` keeps assets in the browser, in one IndexedDB object
store keyed by asset path. It survives a page reload.

```ts
import { IndexedDbAssetSource } from "@jolly-pixel/asset-source/indexeddb";

const source = await IndexedDbAssetSource.open({
  name: "jolly-workspace:default"
});

await source.write("textures/grass.png", bytes);
source.close();
```

The source lives in its own `@jolly-pixel/asset-source/indexeddb` entry, so a
Node.js program never loads it.

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
- `destroy` deletes the database. It waits for every open connection, so
  `close()` the source first.

The source implements the shared [`AssetSource`](./AssetSource.md) storage
contract. It does not provide `isIgnored` or `watch`.

Tests run it on `fake-indexeddb`, passing `new IDBFactory()` as `factory`.
