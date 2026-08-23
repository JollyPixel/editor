# AssetCoordinator

`AssetCoordinator` resolves persistent references and starts runtime loading
operations. Game projects receive a configured coordinator from
`@jolly-pixel/runtime`; custom integrations construct one directly.

## API

```ts
interface AssetCoordinatorOptions {
  catalog: AssetCatalog;
  loaders: AssetLoaderRegistry;
  store?: AssetStore;
}

class AssetCoordinator {
  readonly catalog: AssetCatalog;
  readonly loaders: AssetLoaderRegistry;
  readonly store: AssetStore;

  constructor(options: AssetCoordinatorOptions);

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue>;

  get<TValue>(reference: AssetReference<TValue>): TValue;

  load<TValue>(
    reference: AssetReference<TValue>,
    options?: AssetLoadContext
  ): Promise<TValue>;

  loadBatch(
    references: Iterable<AssetReference<unknown>>,
    options?: AssetLoadBatchOptions
  ): AssetLoadBatch;
}
```

The constructor uses the supplied store or creates a new one.

## `request(reference)`

Resolves the reference against the catalog and returns a typed handle. The
method is synchronous. It creates an unloaded store entry when needed and does
not schedule I/O.

## `get(reference)`

Resolves the reference and returns its prepared value synchronously. It throws
`AssetNotReadyError` while the store entry is unloaded, loading, or failed.

Use this method after startup or another asynchronous boundary has prepared
the reference.

## `load(reference, options?)`

Loads one reference through the loader registered with its `AssetType`. The
returned promise resolves to the loaded value. `options.signal` is passed to
the loader, which decides how to use it.

Concurrent calls share an in-flight store promise. A call after failure starts
a new attempt.

## `loadBatch(references, options?)`

Starts an independent loading operation over a snapshot of the supplied
references. Duplicate asset IDs count once within the batch. Concurrent
batches still share in-flight loads through the coordinator's store.

The coordinator retains no batch dependency list after construction. See
[`AssetLoadBatch`](./AssetLoadBatch.md) for progress and failure behavior.
