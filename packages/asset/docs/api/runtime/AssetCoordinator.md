# AssetCoordinator

`AssetCoordinator` resolves persistent references, starts runtime loading
operations, and owns the loaded values and in-flight loads of one runtime
scope. Game projects receive a configured coordinator from
`@jolly-pixel/runtime`; custom integrations construct one directly.

## API

```ts
interface AssetCoordinatorOptions {
  catalog: AssetCatalog;
  loaders: AssetLoaderRegistry;
}

class AssetCoordinator {
  constructor(options: AssetCoordinatorOptions);

  canLoad(reference: AssetReference<unknown>): boolean;

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue>;

  get<TValue>(reference: AssetReference<TValue>): TValue;

  load<TValue>(reference: AssetReference<TValue>): Promise<TValue>;

  loadBatch(
    references: Iterable<AssetReference<unknown>>,
    options?: AssetLoadBatchOptions
  ): AssetLoadBatch;

  evict<TValue>(reference: AssetReference<TValue>): TValue | undefined;
}
```

Each coordinator keeps its own loaded values. Two coordinators never share
them. The catalog and the loader registry stay private to the coordinator.

## `canLoad(reference)`

Reports whether `load(reference)` would reach a loader: the catalog holds the
asset with the reference's kind, and the reference's `AssetType` is the token
registered with a loader. It throws nothing and loads nothing.

## `request(reference)`

Resolves the reference against the catalog and returns a typed handle. The
method is synchronous, schedules no I/O, and records nothing: an asset nobody
has loaded reports `"unloaded"`.

## `get(reference)`

Resolves the reference and returns its prepared value synchronously. It throws
`AssetNotReadyError` while the asset is unloaded, loading, or failed.

Use this method after startup or another asynchronous boundary has prepared
the reference.

## `load(reference)`

Loads one reference through the loader registered with its `AssetType`. The
returned promise resolves to the loaded value.

Concurrent calls share one in-flight promise. A call after failure starts a
new attempt. A rejection is kept as the asset's failure, whatever value the
loader rejected with.

## `loadBatch(references, options?)`

Starts an independent loading operation over a snapshot of the supplied
references. Duplicate asset IDs count once within the batch. Concurrent
batches still share in-flight loads.

The coordinator retains no batch dependency list after construction. See
[`AssetLoadBatch`](./AssetLoadBatch.md) for progress and failure behavior.

## `evict(reference)`

Forgets one asset and returns its value when it was ready, or `undefined`
otherwise. Existing handles report `"unloaded"` afterwards, and a load still
in flight settles without restoring the entry.

Eviction does not cancel in-flight work or dispose loaded resources. Callers
own platform resource disposal.

## Token identity

When a loader is registered for a kind, every method except `canLoad()` throws
`AssetTypeMismatchError` for a reference built from another `AssetType` token
of that kind. `load()` rejects with it. `canLoad()` returns `false`.
