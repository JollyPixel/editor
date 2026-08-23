# AssetId

`AssetId` is the stable identity of one catalog asset. Constructing an ID does
not generate or register an asset.

## API

```ts
class AssetId {
  readonly value: string;

  constructor(value: string);

  equals(other: AssetId): boolean;
  toJSON(): string;
  toString(): string;

  static from(id: string | AssetId): AssetId;
}
```

The constructor rejects an empty or whitespace-only value with `TypeError`. It
stores other strings unchanged.

`from()` constructs an ID from a string and returns an existing `AssetId`
unchanged. `equals()` compares stored strings. `toJSON()` and `toString()` both
return `value`.

IDs are normally assigned by an editor, importer, or backend when it creates
the matching [`AssetRecord`](./AssetRecord.md).
