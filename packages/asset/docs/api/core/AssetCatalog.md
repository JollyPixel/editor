# AssetCatalog

`AssetCatalog` owns the persistent records for one project or session. It
resolves consumer references while keeping source addresses out of scene and
component data.

## API

```ts
class AssetCatalog implements Iterable<AssetRecord> {
  readonly size: number;

  constructor(records?: Iterable<AssetRecord>);

  add(record: AssetRecord): this;
  has(id: AssetId): boolean;
  replace(record: AssetRecord): this;
  remove(id: AssetId): AssetRecord;
  get(id: AssetId): AssetRecord;
  resolve(reference: AssetReference<unknown>): AssetRecord;
  toJSON(): AssetManifestData;

  static parse(input: unknown): AssetCatalog;
}
```

Initial records pass through the same duplicate-ID check as `add()`.

| Operation | Result | Failure |
|---|---|---|
| `add(record)` | Inserts the record and returns the catalog | `AssetAlreadyExistsError` |
| `has(id)` | Reports whether the ID exists | None |
| `replace(record)` | Replaces an existing record and returns the catalog | `AssetNotFoundError` |
| `remove(id)` | Removes and returns the record | `AssetNotFoundError` |
| `get(id)` | Returns the record | `AssetNotFoundError` |
| `resolve(reference)` | Returns the record after checking its kind | `AssetNotFoundError` or `AssetKindMismatchError` |

Replacing or removing a record does not evict a value already held by an
`AssetStore`. See [catalog changes](../../concepts/runtime-loading-architecture.md#catalog-changes)
for the runtime invalidation sequence.

## Iteration

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
