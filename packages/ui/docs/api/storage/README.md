# Storage API

Stateful components persist through a `StorageAdapter`:

```ts
interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}
```

- Keys are `<storage-key>:<name>`.
- Components that default their `storage` share one `LocalStorageAdapter` for
  the page.
- An empty `storageKey` on `jolly-stats` or `jolly-theme-preferences` turns
  persistence off.

## `LocalStorageAdapter`

```ts
new LocalStorageAdapter(options?: LocalStorageAdapterOptions)

interface LocalStorageAdapterOptions {
  resolve?: () => StorageLike | undefined; // default: globalThis.localStorage
}

const storage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});
```

- After a storage access failure, it falls back to memory for good. The
  shared adapter's fallback outlives any one element, so an element recreated
  with the same key still reads what the last one wrote.
- `persistent` tells whether writes still reach the wrapped storage.

## `MemoryStorageAdapter`

Keeps values in memory for the lifetime of the instance, for tests and
throwaway state.
