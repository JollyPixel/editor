# AssetStore

`AssetStore` owns loaded values and in-flight promises for one runtime scope.
A coordinator uses it to deduplicate concurrent loads.

## API

```ts
type AssetStatus =
  | "unloaded"
  | "loading"
  | "ready"
  | "failed";

class AssetStore {
  readonly size: number;

  request<TValue>(
    reference: AssetReference<TValue>
  ): AssetHandle<TValue>;

  statusOf(reference: AssetReference<unknown>): AssetStatus;
  errorOf(reference: AssetReference<unknown>): unknown | undefined;
  get<TValue>(reference: AssetReference<TValue>): TValue;

  load<TValue>(
    reference: AssetReference<TValue>,
    load: () => Promise<TValue>
  ): Promise<TValue>;

  evict(id: AssetId): unknown | undefined;
  clear(): void;
}
```

## Entry state

`request()`, `statusOf()`, and `errorOf()` create an unloaded entry when the ID
is absent. Once an ID has an entry, later references must use the same kind and
`AssetType` token. Violations throw `AssetKindMismatchError` or
`AssetTypeMismatchError`.

`errorOf()` returns a value only for the `"failed"` state. `get()` returns the
ready value or throws `AssetNotReadyError` with the current status.

## Loading and retry

`load()` returns a promise already resolved with a ready value, shares a promise
already in flight, or calls the supplied callback. It records a rejection as
the entry's failure. A later call retries an entry in the failed state.

The callback can reject with any JavaScript value. The store preserves that
value as the failure.

## Eviction

`evict()` removes one entry and returns its value when the entry was ready. It
returns `undefined` for missing, unloaded, loading, or failed entries.

`clear()` removes every entry. Neither operation cancels in-flight work or
disposes loaded resources. Callers own platform resource disposal.
