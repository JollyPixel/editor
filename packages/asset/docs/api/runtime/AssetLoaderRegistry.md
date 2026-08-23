# AssetLoaderRegistry

`AssetLoaderRegistry` maps each persistent kind to one loader and one shared
`AssetType` token.

## API

```ts
class AssetLoaderRegistry {
  readonly size: number;

  register<TValue>(
    type: AssetType<TValue>,
    loader: AssetLoader<TValue>
  ): this;

  has(type: AssetType<unknown>): boolean;
  get<TValue>(type: AssetType<TValue>): AssetLoader<TValue>;
}
```

`register()` returns the registry for chaining. Registering any second loader
for the same kind throws `AssetLoaderAlreadyExistsError`.

`has()` returns `true` only when the kind and token object both match.

`get()` preserves the value type carried by the token. It throws
`AssetLoaderNotFoundError` when the kind is absent and `AssetTypeMismatchError`
when the kind was registered with another token object.

```ts
const loaders = new AssetLoaderRegistry()
  .register(MODEL_ASSET, modelLoader)
  .register(AUDIO_ASSET, audioLoader);
```
