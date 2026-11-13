# AssetType

`AssetType<TValue>` binds a persistent asset kind to the value produced by its
loader.

## API

```ts
class AssetType<TValue = unknown> {
  readonly kind: AssetKind;

  constructor(kind: string | AssetKind);
}
```

The constructor wraps `kind` with `AssetKind.from()`, which throws `TypeError`
for an invalid kind. See [`AssetKind`](./AssetKind.md) for the rule.

Define and share one token for each kind:

```ts
interface Model {
  readonly path: string;
}

export const MODEL_ASSET = new AssetType<Model>("model");
```

The kind string is persisted. The token object is a runtime contract used by
`AssetReference`, `AssetLoaderRegistry`, and `AssetCoordinator`. Two
`AssetType` instances with the same kind are still different tokens, so compare
tokens with `===`. Once a loader is registered for a kind, the coordinator
throws `AssetTypeMismatchError` for references built from any other token of
that kind.
