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
`200` from the source, other methods `405`. Reads go through the
`AssetSource`, so an in-memory source is servable too.

The request target is stripped of its query and fragment, decoded once, then
validated by [`safeAssetPath`](./Utilities.md#safeassetpath), so the source
only ever sees a root-relative POSIX path. The rejection decides the status:

| Case | Status |
|---|---|
| Absolute, drive-qualified or `..` path, source refusing the path | `403` |
| Malformed escape sequence, control character in the path | `400` |
| Missing file, directory target, state directory, path the source ignores | `404` |

The state directory is matched case-insensitively, because a
case-insensitive filesystem answers `.JOLLYPIXEL/state.json` from
`.jollypixel/`. Paths a source hides through `isIgnored` (`.git/`,
`node_modules/`, `dist/` by default) answer `404` as well.

| Option | Default | Description |
|---|---|---|
| `source` | required | Source the bytes are read from. |
| `prefix` | `ASSET_URL_PREFIX` (`/assets/`) | URL prefix, with a trailing slash added when missing. |
| `contentTypes` | none | Extension-to-content-type entries merged over `DEFAULT_CONTENT_TYPES`. |

## Content types

```ts
resolveContentType(
  assetPath: string,
  table?: Readonly<Record<string, string>>
): string
```

Picks the longest `table` key (`DEFAULT_CONTENT_TYPES` by default) that ends
the lowercased file name of `assetPath`, so `.voxelmap.json` wins over
`.json`. Keys are lowercase and include the leading dot. A file named after
the extension alone, or matching no key, gets `DEFAULT_CONTENT_TYPE`
(`application/octet-stream`).

`DEFAULT_CONTENT_TYPES` covers `.json`, `.txt`, `.png`, `.jpg`, `.jpeg`,
`.webp`, `.gif`, `.bmp` and `.svg`.
