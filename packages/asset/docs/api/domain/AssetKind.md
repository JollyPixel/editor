# AssetKind

`AssetKind` is the validated persistent category of an asset, such as `model`
or `texture`. `AssetType`, `AssetRecord`, `AssetRoom` and the kind errors all
hold one, so a kind accepted by one of them is accepted by all of them.

## API

```ts
class AssetKind {
  readonly value: string;

  constructor(value: string);

  equals(other: AssetKind): boolean;
  toJSON(): string;
  toString(): string;

  static from(kind: string | AssetKind): AssetKind;
}
```

The constructor throws `TypeError` for an empty or whitespace-only value, and
for a value containing `:` or `@`. Both characters are separators in
[`AssetRoom`](./AssetRoom.md) names.

`from()` constructs a kind from a string and returns an existing `AssetKind`
unchanged. `equals()` compares values. `toJSON()` and `toString()` both return
`value`, so persisted data keeps the plain string.

```ts
const [first] = catalog.byKind("voxelmap");
first?.kind.value;
// "voxelmap"
```
