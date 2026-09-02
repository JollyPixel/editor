# Errors

The package exports typed errors for catalog validation and runtime loading.
All of them extend `Error` and set `name` to the class name.

## Catalog and persistence

| Error | Thrown when |
|---|---|
| `AssetAlreadyExistsError` | `AssetCatalog.add()` receives an existing ID |
| `AssetNotFoundError` | A catalog operation cannot find the requested ID |
| `AssetKindMismatchError` | A reference's expected kind differs from persisted or stored data |
| `AssetKindNotFoundError` | `AssetCatalog.firstOfKind()` matches no record |
| `UnsupportedAssetManifestError` | `AssetCatalog.parse()` receives a version other than `1` |
| `AssetFetchError` | `AssetCatalog.fetch()` or `AssetRecord.fetch()` gets a non-2xx status |

`AssetKindNotFoundError.kind` contains the requested kind. `AssetFetchError`
carries the requested `url`, HTTP `status`, and `record`. Its `record` is
`null` for catalog requests. Transport errors from the global `fetch`
propagate unchanged.

Invalid persistence shapes and empty string values throw `TypeError` rather
than a package-specific error.

## Loader and store configuration

| Error | Thrown when |
|---|---|
| `AssetLoaderAlreadyExistsError` | A registry already has a loader for the kind |
| `AssetLoaderNotFoundError` | A load uses a kind with no registered loader |
| `AssetTypeMismatchError` | The same kind is used through another `AssetType` token |
| `AssetNotReadyError` | Synchronous access occurs before an entry is ready |

`AssetNotReadyError.status` contains the current `AssetStatus`.

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
