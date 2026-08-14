# AssetReference

## `new AssetId(value)`

Creates an immutable identifier for one catalog asset. `value` must contain at
least one non-whitespace character; invalid values throw a `TypeError`.

IDs are supplied by the editor, importer, or backend that creates the catalog
record. Constructing an `AssetId` does not generate or register anything.

## `AssetId.equals(other)`

Returns `true` when both IDs contain the same string.

## `AssetId.toString()`

Returns the stored string. `toJSON()` returns the same value.

## `AssetReferenceData`

```ts
interface AssetReferenceData {
  readonly id: string;
  readonly kind: string;
}
```

This is the representation stored in a scene or sent over the network.

## `new AssetType<TValue>(kind)`

Creates the runtime token for one persistent kind. The token binds `kind` to
the value returned by its loader, while its runtime state remains the kind
string. An empty kind throws a `TypeError`.

Define one shared token for each asset kind:

```ts
interface Model {
  readonly source: string;
}

const MODEL_ASSET = new AssetType<Model>("model");
```

## `new AssetReference(id, type)`

Creates an immutable reference from an `AssetId` or string. String IDs are
parsed into an `AssetId`, including the same empty-value check. `type` supplies
the persistent kind and the runtime value type expected by the scene.

```ts
const heroModel = new AssetReference(
  "hero-model",
  MODEL_ASSET
);
```

`AssetReference<TValue>` carries `TValue` into `AssetHandle<TValue>`. The
coordinator uses the same `AssetType<TValue>` token to find a compatible
loader at runtime.

## `AssetReferenceGroup`

`AssetReferenceGroup` describes a named, read-only record of references. Use
`satisfies` so TypeScript checks the group while preserving the value type of
each entry:

```ts
const assets = {
  hero: new AssetReference("model.hero", MODEL_ASSET)
} satisfies AssetReferenceGroup;
```

The names are local developer-facing keys. Persistent identity still comes
from each reference's asset ID.

## `AssetReference.parse(input, type)`

Parses unknown persistence input into an `AssetReference`. The complete
reference shape is checked before the domain object is returned. Its persisted
kind must match `type.kind`; otherwise parsing throws
`AssetKindMismatchError`. Invalid field types and empty values throw a
`TypeError`.

## `AssetReference.equals(other)`

Returns `true` when both references have the same ID and kind.

## `AssetReference.toJSON()`

Returns a new `AssetReferenceData` object.
