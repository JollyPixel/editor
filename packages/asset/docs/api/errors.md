# Errors

The package exports typed errors for catalog validation and runtime loading.
All of them extend `Error` and set `name` to the class name.

## Catalog and persistence

| Error | Thrown when |
|---|---|
| `AssetAlreadyExistsError` | `AssetCatalog.add()` receives an existing ID |
| `AssetNotFoundError` | A catalog operation cannot find the requested ID |
| `AssetKindMismatchError` | A reference's expected kind differs from the persisted kind |
| `UnsupportedAssetManifestError` | `AssetCatalog.parse()` receives a version other than `1` |

`AssetAlreadyExistsError` and `AssetNotFoundError` carry the `id`.
`AssetKindMismatchError` carries the `id`, `expectedKind`, and `actualKind`.
`UnsupportedAssetManifestError` carries the `version`.

A malformed shape passed to a `parse()` method throws a `ZodError`. Blank
values, and asset kinds containing a colon, throw `TypeError`.

## Loader and store configuration

| Error | Thrown when |
|---|---|
| `AssetLoaderAlreadyExistsError` | A registry already has a loader for the kind |
| `AssetLoaderNotFoundError` | A load uses a kind with no registered loader |
| `AssetTypeMismatchError` | The same kind is used through another `AssetType` token |
| `AssetNotReadyError` | Synchronous access occurs before an asset is ready |

The loader errors and `AssetTypeMismatchError` carry the `kind`.
`AssetNotReadyError` carries the `id` and the current `AssetStatus` as
`status`.

## Batch failure

```ts
interface AssetLoadFailure {
  readonly record: AssetRecord;
  readonly error: unknown;
}

class AssetBatchLoadError extends Error {
  readonly failures: readonly AssetLoadFailure[];

  constructor(failures: Iterable<AssetLoadFailure>);
}
```

`AssetBatchLoadError` collects every asset task that failed in one batch. A
loader may reject with any JavaScript value, including `undefined`, so each
failure's `error` is typed as `unknown`.

An exception thrown by `onProgress` rejects `AssetLoadBatch.done` directly. It
is not wrapped in `AssetBatchLoadError` and does not appear in `failures`.
