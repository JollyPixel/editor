# AssetReference

`AssetReference<TValue>` is the portable value stored by scenes, components,
saved data, and network messages. It identifies an asset and records the kind
of runtime value the consumer expects.

## API

```ts
class AssetReference<TValue = unknown> {
  readonly id: AssetId;
  readonly type: AssetType<TValue>;
  readonly kind: string;

  constructor(
    id: AssetId | string,
    type: AssetType<TValue>
  );

  equals(other: AssetReference<unknown>): boolean;
  toJSON(): AssetReferenceData;

  static parse<TValue>(
    input: unknown,
    type: AssetType<TValue>
  ): AssetReference<TValue>;
}
```

The constructor converts a string ID to an [`AssetId`](../domain/AssetId.md).
`kind` returns `type.kind`.

`TValue` flows into `AssetHandle<TValue>` and the loader registered for the
same [`AssetType`](../domain/AssetType.md). Runtime integrations must reuse the
same asset type object for references and loader registration.

## Persistence

```ts
interface AssetReferenceData {
  readonly id: string;
  readonly kind: string;
}
```

`toJSON()` returns a new data object. `parse()` validates unknown input and
checks that the persisted kind equals `type.kind`. A mismatched kind throws
`AssetKindMismatchError`; invalid fields throw `TypeError`.

```ts
const heroModel = new AssetReference(
  "hero-model",
  MODEL_ASSET
);

const restored = AssetReference.parse(
  heroModel.toJSON(),
  MODEL_ASSET
);
```

`equals()` returns `true` when both references have the same ID and kind.

## Named groups

`AssetReferenceGroup` is a read-only record of named references:

```ts
type AssetReferenceGroup = Readonly<
  Record<string, AssetReference<unknown>>
>;
```

Use `satisfies` to check the group without erasing each entry's value type:

```ts
const assets = {
  hero: new AssetReference("hero-model", MODEL_ASSET)
} satisfies AssetReferenceGroup;
```

The record keys are local names. Persistent identity comes from the reference's
asset ID.
