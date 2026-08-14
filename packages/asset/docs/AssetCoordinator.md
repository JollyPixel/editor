# AssetCoordinator

## `AssetLoader<TValue>`

```ts
interface AssetLoader<TValue> {
  load(
    record: AssetRecord,
    context: AssetLoadContext
  ): Promise<TValue>;
}
```

A loader converts one catalog record into a runtime value. The loader owns the
platform-specific I/O for `record.source`. `AssetLoadContext.signal` provides
an optional `AbortSignal`.

## `AssetLoaderRegistry`

`register(type, loader)` assigns one loader to an `AssetType<TValue>` and
returns the registry. Duplicate kinds throw `AssetLoaderAlreadyExistsError`.

`get(type)` returns the loader inferred from the token. A missing kind throws
`AssetLoaderNotFoundError`. Reusing a kind through another token throws
`AssetTypeMismatchError`. `has(type)` checks token registration without
throwing.

## `AssetStore`

An `AssetStore` owns transient values and in-flight promises for one runtime
scope. Each entry has one of these states:

- `"unloaded"`
- `"loading"`
- `"ready"`
- `"failed"`

`request(reference)` creates a typed handle. `load(reference, callback)` runs
the callback once for concurrent requests, records failures, and permits a
later retry. `get(reference)` returns a ready value or throws
`AssetNotReadyError`.

`evict(id)` removes an entry and returns its resolved value when present. The
caller can dispose engine-owned resources from that return value. `clear()`
removes every entry.

## `AssetHandle<TValue>`

An asset handle exposes the persistent `reference`, current `status`, last
`error`, and synchronous `get()` method. Handles share their owning store and
are not serialized.

## `new AssetCoordinator(options)`

```ts
interface AssetCoordinatorOptions {
  catalog: AssetCatalog;
  loaders: AssetLoaderRegistry;
  store?: AssetStore;
}
```

The coordinator uses the supplied store or creates a new one.

## `request(reference)`

Validates the reference against the catalog and returns an
`AssetHandle<TValue>`. This method is synchronous. It does not schedule or
record a future load.

## `get(reference)`

Resolves the reference against the catalog and returns its prepared value
synchronously. It throws `AssetNotReadyError` when the asset has not finished
loading. Runtime-facing code can use this when an asynchronous boundary has
already prepared the asset.

## `load(reference, options?)`

Loads one reference with the loader registered for its catalog kind. This is
available for editor tools and explicit dynamic loading.

## `loadBatch(references, options?)`

Starts an independent load for a snapshot of the supplied references and
returns an [`AssetLoadBatch`](./AssetLoadBatch.md). Duplicate IDs count once.
The shared `AssetStore` still runs one loader when concurrent batches contain
the same asset.

The coordinator does not retain the references after creating the batch. A
runtime can therefore create separate batches for startup, scene transitions,
or dynamic content.
