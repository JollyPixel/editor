# Asset identity and persistence

An asset has a stable identity, a consumer-facing reference, and a catalog
record that can change over time.

```text
AssetReference              AssetCatalog                 AssetRecord
id + expected kind  ----->  record lookup       ----->  source + revision
                        resolve and validate
```

## Stable identity

`AssetId` identifies the logical asset. Editors, importers, and backends choose
IDs when creating catalog records. Moving `models/hero.glb` or replacing its
contents does not require scene data to change.

`AssetReference` stores the ID and expected kind. Its JSON representation is
small enough for scenes, components, saved data, and network messages:

```json
{
  "id": "hero-model",
  "kind": "model"
}
```

The reference carries no source address.

## Catalog records

`AssetCatalog` owns the current `AssetRecord` for each ID. A record connects
the ID and kind to an opaque source. Loaders interpret that source according to
the platform and asset type.

The optional revision can hold a content hash, entity tag, or backend revision
token. A revision change does not alter the asset ID.

## Kind and type

The persisted `kind` is a string such as `"model"`. `AssetType<TValue>` is the
runtime token for that kind and the value returned by its loader. Sharing one
token object lets TypeScript carry `TValue` from a reference to its loader and
handle.

Catalog resolution compares the persisted kinds. Loader and store lookup also
check token identity, which catches two incompatible runtime definitions that
reuse the same kind string.

## Manifest boundary

`AssetCatalog.toJSON()` creates a versioned manifest. `AssetCatalog.parse()`
validates unknown input and reconstructs the records. Loaded values, loader
registrations, handles, and store state never appear in the manifest.
