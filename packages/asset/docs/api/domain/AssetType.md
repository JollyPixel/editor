# AssetType

`AssetType<TValue>` binds a persistent asset kind to the value produced by its
loader.

## API

```ts
class AssetType<TValue = unknown> {
  readonly kind: string;

  constructor(kind: string);
}
```

The constructor throws `TypeError` for an empty or whitespace-only kind.

Define and share one token for each kind:

```ts
interface Model {
  readonly source: string;
}

export const MODEL_ASSET = new AssetType<Model>("model");
```

The kind string is persisted. The token object is a runtime contract used by
`AssetReference`, `AssetLoaderRegistry`, and `AssetStore`. Two `AssetType`
instances with the same kind are still different tokens; using both in one
runtime scope throws `AssetTypeMismatchError`.
