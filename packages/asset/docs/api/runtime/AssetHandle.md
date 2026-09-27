# AssetHandle

`AssetHandle<TValue>` provides synchronous typed access to one asset held by
an `AssetCoordinator`.

## API

```ts
type AssetStatus =
  | "unloaded"
  | "loading"
  | "ready"
  | "failed";

class AssetHandle<TValue = unknown> {
  readonly reference: AssetReference<TValue>;
  readonly status: AssetStatus;
  readonly error: unknown | undefined;

  get(): TValue;
}
```

Call `AssetCoordinator.request()` to obtain a handle. Handles read their
coordinator's current state and are not serialized.

`status` reflects the asset's current state. `error` contains the last
rejection only while the state is `"failed"`. `get()` returns the ready value
or throws `AssetNotReadyError`.

```ts
const handle = assets.request(heroReference);

await assets.load(heroReference);

const model = handle.get();
```

An existing handle remains usable after eviction. Its status becomes
`"unloaded"`, and a later load makes the new value available through it.
