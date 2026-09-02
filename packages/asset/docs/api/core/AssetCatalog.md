# AssetCatalog

`AssetCatalog` owns the persistent records for one project or session. It
resolves consumer references while keeping source addresses out of scene and
component data.

## API

```ts
class AssetCatalog implements Iterable<AssetRecord> {
  static async fetch(url?: string): Promise<AssetCatalog>;

  readonly size: number;

  constructor(records?: Iterable<AssetRecord>);

  add(record: AssetRecord): this;
  has(id: AssetId): boolean;
  replace(record: AssetRecord): this;
  remove(id: AssetId): AssetRecord;
  get(id: AssetId): AssetRecord;
  byKind(kind: string): IterableIterator<AssetRecord>;
  firstOfKind(kind: string): AssetRecord;
  resolve(reference: AssetReference<unknown>): AssetRecord;
  toJSON(): AssetManifestData;

  static parse(input: unknown): AssetCatalog;
}
```

`fetch()` requests `CATALOG_URL_PATH` by default and passes the JSON response
to `parse()`. It throws `AssetFetchError` for non-2xx responses. Transport and
JSON-decoding errors propagate unchanged, as do errors from `parse()`.

Initial records pass through the same duplicate-ID check as `add()`.

| Operation | Result | Failure |
|---|---|---|
| `add(record)` | Inserts the record and returns the catalog | `AssetAlreadyExistsError` |
| `has(id)` | Reports whether the ID exists | None |
| `replace(record)` | Replaces an existing record and returns the catalog | `AssetNotFoundError` |
| `remove(id)` | Removes and returns the record | `AssetNotFoundError` |
| `get(id)` | Returns the record | `AssetNotFoundError` |
| `byKind(kind)` | Iterates the records of one kind, in insertion order | None |
| `firstOfKind(kind)` | Returns the first record of one kind | `AssetKindNotFoundError` |
| `resolve(reference)` | Returns the record after checking its kind | `AssetNotFoundError` or `AssetKindMismatchError` |

Replacing or removing a record does not evict a value already held by an
`AssetStore`. See [catalog changes](../../concepts/runtime-loading-architecture.md#catalog-changes)
for the runtime invalidation sequence.

## Iteration

`byKind()` is lazy. A matching record removed before the iterator reaches it
is skipped. `firstOfKind()` returns the first matching record:

```ts
const world = catalog.firstOfKind("voxelmap");
```

Direct iteration preserves insertion order:

```ts
for (const record of catalog) {
  console.log(record.id);
}
```

Spread syntax and `Array.from(catalog)` produce arrays of records. Passing a
catalog to the constructor copies its current records into a new catalog.

## Manifest format

```ts
interface AssetManifestData {
  readonly version: 1;
  readonly assets: readonly AssetRecordData[];
}
```

`toJSON()` returns the current versioned manifest:

```json
{
  "version": 1,
  "assets": [
    {
      "id": "hero-model",
      "kind": "model",
      "source": "models/hero.glb",
      "revision": "sha256:abc"
    }
  ]
}
```

`AssetCatalog.parse()` validates unknown input and parses every
[`AssetRecord`](../domain/AssetRecord.md) before constructing the catalog.
Unsupported versions throw `UnsupportedAssetManifestError`.
