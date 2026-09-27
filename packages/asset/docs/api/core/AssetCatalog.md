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
  set(record: AssetRecord): this;
  has(id: AssetId | string): boolean;
  find(id: AssetId | string): AssetRecord | undefined;
  get(id: AssetId | string): AssetRecord;
  remove(id: AssetId | string): AssetRecord;
  byKind(kind: string): IterableIterator<AssetRecord>;
  resolve(reference: AssetReference<unknown>): AssetRecord;
  toJSON(): AssetManifestData;

  static parse(input: unknown): AssetCatalog;
}
```

Initial records pass through the same duplicate-ID check as `add()`.

| Operation | Result | Failure |
|---|---|---|
| `add(record)` | Inserts the record and returns the catalog | `AssetAlreadyExistsError` |
| `set(record)` | Inserts the record, or replaces the one with its ID, and returns the catalog | None |
| `has(id)` | Reports whether the ID exists | None |
| `find(id)` | Returns the record, or `undefined` | None |
| `get(id)` | Returns the record | `AssetNotFoundError` |
| `remove(id)` | Removes and returns the record | `AssetNotFoundError` |
| `byKind(kind)` | Iterates the records of one kind, in insertion order | None |
| `resolve(reference)` | Returns the record after checking its kind | `AssetNotFoundError` or `AssetKindMismatchError` |

Replacing or removing a record does not evict a value already held by an
`AssetCoordinator`. See [catalog changes](../../concepts/runtime-loading-architecture.md#catalog-changes)
for the runtime invalidation sequence.

## Iteration

`byKind()` is lazy. A matching record removed before the iterator reaches it
is skipped. Destructure it to read the first matching record:

```ts
const [world] = catalog.byKind("voxelmap");
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

`AssetCatalog.parse()` reads `version` first and throws
`UnsupportedAssetManifestError` for any version other than `1`. It then parses
every [`AssetRecord`](../domain/AssetRecord.md) before constructing the
catalog. A malformed manifest throws a `ZodError`.
