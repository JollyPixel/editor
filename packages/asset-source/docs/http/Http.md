# HTTP serving

`createAssetStaticHandler` serves an `AssetSource` over HTTP as a
connect-style middleware, usable with `node:http`, Vite or Express.

```ts
import {
  createAssetStaticHandler,
  FilesystemAssetSource
} from "@jolly-pixel/asset-source";

const handler = createAssetStaticHandler({
  source: new FilesystemAssetSource("./assets"),
  contentTypes: {
    ".pixelart": "application/json; charset=utf-8"
  }
});
```

Requests outside the prefix are passed to `next()`. `GET` and `HEAD` answer
from the source, other methods `405`. Reads go through the `AssetSource`, so
an in-memory source is servable too.

The handler is built on
[`@openally/servo`](https://github.com/OpenAlly/npm-packages/tree/main/src/servo).
Every file carries a strong ETag hashed from its bytes,
`Cache-Control: no-cache` and `X-Content-Type-Options: nosniff`. A matching
`If-None-Match` answers `304` and a single byte `Range` answers `206`.

The request target is stripped of its query and fragment, decoded once, then
validated by servo's `safePath`, so the source only ever sees a
root-relative POSIX path. The rejection decides the status:

| Case | Status |
|---|---|
| Absolute, drive-qualified or `..` path, source refusing the path | `403` |
| Segment with `:`, a trailing dot or space, or a Windows device name (`con.png`) | `403` |
| Malformed escape sequence, control character in the path | `400` |
| Missing file, directory target, state directory, path the source ignores | `404` |

The state directory is matched case-insensitively, because a
case-insensitive filesystem answers `.JOLLYPIXEL/state.json` from
`.jollypixel/`. Paths a source hides through `isIgnored` (`.git/`,
`node_modules/`, `dist/` by default) answer `404` as well.

| Option | Default | Description |
|---|---|---|
| `source` | required | Source the bytes are read from. |
| `prefix` | `ASSET_URL_PREFIX` (`/assets/`) | URL prefix. `/assets` and `/assets/` behave the same. |
| `contentTypes` | none | Extension-to-content-type entries merged over `DEFAULT_CONTENT_TYPES`. |

## Content types

```ts
resolveContentType(
  assetPath: string,
  table?: Readonly<Record<string, string>>
): string
```

Picks the longest `table` key (`DEFAULT_CONTENT_TYPES` by default) that ends
the file name of `assetPath`, ignoring case, so `.voxelmap.json` wins over
`.json`. Keys include the leading dot. A file named after the extension alone,
or matching no key, gets `DEFAULT_CONTENT_TYPE` (`application/octet-stream`).
A textual type without parameters gets `; charset=utf-8`. The lookup is
servo's `contentType`, run on this table instead of servo's defaults.

`DEFAULT_CONTENT_TYPES` covers `.json`, `.txt`, `.png`, `.jpg`, `.jpeg`,
`.webp`, `.gif`, `.bmp` and `.svg`. It leaves out `.html`, `.js` and `.css`,
so an uploaded page or script is served as an octet stream.
