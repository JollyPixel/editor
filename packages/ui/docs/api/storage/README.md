# Storage API

Stateful components accept this interface:

```ts
interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}
```

`LocalStorageAdapter` wraps a `StorageLike` object and permanently falls back
to memory after a storage access failure. Its `persistent` getter reports
whether writes still reach the wrapped storage.

`LocalStorageAdapterOptions` accepts an optional `resolve()` function that
returns a `StorageLike` value.

```ts
const storage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});
```

`MemoryStorageAdapter` stores string values in memory for the lifetime of the
instance. It is useful for tests and non-persistent component state.
