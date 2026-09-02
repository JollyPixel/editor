# AssetRecord

`AssetRecord` describes the current source and revision assigned to one stable
asset ID.

## API

```ts
interface AssetRecordFetchOptions extends RequestInit {
  prefix?: string;
}

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

  sourceUrl(prefix?: string): string;
  fetch(options?: AssetRecordFetchOptions): Promise<Response>;
  text(options?: AssetRecordFetchOptions): Promise<string>;

  toJSON(): AssetRecordData;
  static parse(input: unknown): AssetRecord;
}
```

`kind` and `source` must contain at least one non-whitespace character. When
present, `revision` must meet the same rule. Invalid values throw `TypeError`.

The asset package treats `source` as opaque. A loader can interpret it as a
project path, URL, filesystem location, database key, or another
application-defined scheme.

## Reading the bytes

`sourceUrl()` builds a URL with
[`assetSourceUrl()`](../integration-utilities.md#asset-urls). Its `prefix`
defaults to `ASSET_URL_PREFIX`.

`fetch()` requests that URL through the global `fetch`, forwarding every
option except `prefix` as a `RequestInit`. It returns the response for a 2xx
status and throws `AssetFetchError` otherwise. `text()` returns the response
body as text.

These helpers treat `source` as a path served beneath the prefix. Other source
schemes still require a loader.

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
