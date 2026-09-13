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

Components that default their `storage` property share one
`LocalStorageAdapter` for the page. When `localStorage` fails, its memory
fallback outlives any single element, so an element recreated with the same
key still reads what the previous one wrote.

Keys are `<storage-key>:<name>`. An empty `storageKey` on `jolly-stats` or
`jolly-theme-preferences` disables persistence.
