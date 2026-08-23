# AssetHandle

`AssetHandle<TValue>` provides synchronous typed access to one entry in an
`AssetStore`.

## API

```ts
class AssetHandle<TValue = unknown> {
  readonly reference: AssetReference<TValue>;
  readonly status: AssetStatus;
  readonly error: unknown | undefined;

  constructor(
    reference: AssetReference<TValue>,
    store: AssetStore
  );

  get(): TValue;
}
```

Call `AssetCoordinator.request()` or `AssetStore.request()` to obtain a handle.
Handles share their owning store and are not serialized.

`status` reflects the store entry's current state. `error` contains the last
rejection only while the state is `"failed"`. `get()` returns the ready value
or throws `AssetNotReadyError`.

```ts
const handle = assets.request(heroReference);

await assets.load(heroReference);

const model = handle.get();
```

An existing handle remains usable after eviction. Its status becomes
`"unloaded"`, and a later load updates the same underlying store entry.
