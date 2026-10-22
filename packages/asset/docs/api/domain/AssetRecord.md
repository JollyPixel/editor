# AssetRecord

`AssetRecord` describes the current path and revision assigned to one stable
asset ID.

## API

```ts
interface AssetRecordOptions {
  readonly id: AssetId | string;
  readonly kind: AssetKind | string;
  readonly path: AssetPath | string;
  readonly revision?: string;
}

class AssetRecord {
  readonly id: AssetId;
  readonly kind: AssetKind;
  readonly path: AssetPath;
  readonly revision: string | undefined;

  constructor(options: AssetRecordOptions);

  hasKind(kind: AssetKind | string): boolean;
  toJSON(): AssetRecordData;
  static parse(input: unknown): AssetRecord;
}
```

String options are wrapped with [`AssetKind`](./AssetKind.md) and
[`AssetPath`](./AssetPath.md), which throw `TypeError` for a blank value or an
invalid kind. When present, `revision` must contain a non-whitespace
character, or the constructor throws `TypeError`.

`hasKind()` compares the record kind with `kind`. A string goes through
`AssetKind.from()` first, so an invalid kind name throws `TypeError`.

The asset package treats `path` as an opaque address. A loader can interpret it
as a project path, URL, filesystem location, database key, or another
application-defined scheme.

## Persistence

```ts
interface AssetRecordData {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
  readonly revision?: string;
}
```

`toJSON()` returns a new data object and omits `revision` when it is undefined.
`parse()` throws a `$ZodError` for a malformed shape, then applies the
constructor rules above.
