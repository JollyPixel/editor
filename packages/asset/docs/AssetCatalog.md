# AssetCatalog

## `AssetRecordOptions`

```ts
interface AssetRecordOptions {
  readonly id: AssetId | string;
  readonly kind: string;
  readonly source: string;
  readonly revision?: string;
}
```

`source` is opaque to the asset package. A loader decides whether it represents
a project path, URL, filesystem location, or another scheme. `revision` can
store a content hash, entity tag, or backend revision token.

## `new AssetRecord(options)`

Creates immutable catalog metadata for one stable ID. `kind` and `source` must
not be empty. When supplied, `revision` must not be empty.

`AssetRecord.parse(input)` parses unknown persistence input.
`AssetRecord.toJSON()` returns a new `AssetRecordData` object.

## `new AssetCatalog(records?)`

Creates an instance-scoped catalog. Initial records are added with the same
duplicate-ID checks as `add()`.

## `add(record)`

Inserts a new record and returns the catalog. An existing ID throws
`AssetAlreadyExistsError`.

## `replace(record)`

Replaces the record for an existing ID and returns the catalog. A missing ID
throws `AssetNotFoundError`.

Replacing a record does not evict an already loaded runtime value. Use
`AssetStore.evict(id)` and dispose the returned engine resource when required.

## `remove(id)`

Removes and returns an existing record. A missing ID throws
`AssetNotFoundError`.

## `get(id)`

Returns the record for `id` or throws `AssetNotFoundError`.

## `resolve(reference)`

Returns the referenced record and checks its kind. A stale scene reference
throws `AssetKindMismatchError` when its expected kind differs from the catalog
record.

## Iteration

`AssetCatalog` implements `Iterable<AssetRecord>`. Direct iteration preserves
record insertion order:

```ts
for (const record of catalog) {
  console.log(record.id);
}
```

Spread syntax and `Array.from(catalog)` produce an array of records. A catalog
can also be passed to the `AssetCatalog` constructor to copy its records.

## Persistence format

`toJSON()` returns a versioned manifest:

```json
{
  "version": 1,
  "assets": [
    {
      "id": "hero-model",
      "kind": "model",
      "source": "project:/models/hero.glb",
      "revision": "sha256:abc"
    }
  ]
}
```

`AssetCatalog.parse(input)` parses an unknown manifest into a catalog. It
parses every record before the catalog is constructed. Unsupported versions throw
`UnsupportedAssetManifestError`.
