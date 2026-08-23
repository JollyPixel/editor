# AssetRecord

`AssetRecord` describes the current source and revision assigned to one stable
asset ID.

## API

```ts
interface AssetRecordOptions {
  readonly id: AssetId | string;
  readonly kind: string;
  readonly source: string;
  readonly revision?: string;
}

class AssetRecord {
  readonly id: AssetId;
  readonly kind: string;
  readonly source: string;
  readonly revision: string | undefined;

  constructor(options: AssetRecordOptions);

  toJSON(): AssetRecordData;
  static parse(input: unknown): AssetRecord;
}
```

`kind` and `source` must contain at least one non-whitespace character. When
present, `revision` must meet the same rule. Invalid values throw `TypeError`.

The asset package treats `source` as opaque. A loader can interpret it as a
project path, URL, filesystem location, database key, or another
application-defined scheme.

## Persistence

```ts
interface AssetRecordData {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly revision?: string;
}
```

`toJSON()` returns a new data object and omits `revision` when it is undefined.
`parse()` validates unknown input before returning a record.
