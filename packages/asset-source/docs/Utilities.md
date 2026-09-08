# Utilities

The package entry point exports helpers for asset paths, workspace state and
JSON files.

## Asset paths

Asset paths are root-relative POSIX strings. The validators normalize
backslashes, repeated separators and inner `.` or `..` segments.

### `safeAssetPath`

```ts
safeAssetPath(
  input: string
): Result<string, AssetPathRejection>
```

Returns the normalized path in an `Ok`, or a rejection reason in an `Err`.
Use it for input that should be rejected without throwing.

| Rejection | Example |
|---|---|
| `empty` | `""` |
| `invalid` | a path containing `NUL` or another control character |
| `absolute` | `/etc/passwd`, `C:/Windows/win.ini`, `\\server\share` |
| `traversal` | `../secret`, `textures/../../secret` |
| `directory` | `.`, `textures/` |

`AssetPathRejection` also contains `reserved`. `safeAssetPath` does not return
it. Applications can use it when a valid asset path names an application-owned
location such as `.jollypixel/`.

### `normalizeAssetPath`

```ts
normalizeAssetPath(input: string): string
```

Returns the same normalized value as `safeAssetPath`. A rejected input throws
`AssetPathEscapeError`.

```ts
const path = normalizeAssetPath("textures\\tiles\\../grass.png");
// "textures/grass.png"
```

### `AssetPathEscapeError`

```ts
class AssetPathEscapeError extends Error {
  readonly path: string;
  readonly reason: AssetPathRejection;
}
```

`path` contains the rejected input. `reason` contains the rejection reported
by `safeAssetPath`, or a policy reason supplied by the caller.

### `toRelativePosix`

```ts
toRelativePosix(
  root: string,
  absolute: string
): string | null
```

Returns a POSIX path relative to `root`. It returns `null` when `absolute`
equals `root`, lies outside it or cannot be represented as a relative child.

## State directory

```ts
const STATE_DIRECTORY = ".jollypixel";
isStatePath(assetPath: string): boolean
```

`isStatePath` matches the state directory itself and its children at the source
root. Matching is case-insensitive. A nested path such as
`textures/.jollypixel/state.json` is an ordinary asset path.

The path validators accept state paths. The built-in sources keep them
readable and writable while excluding them from `list()`.

## JSON files

```ts
readJsonFile(
  source: AssetSource,
  path: string
): Promise<unknown>

writeJsonFile(
  source: AssetSource,
  path: string,
  value: unknown
): Promise<void>
```

`readJsonFile` decodes the stored bytes as UTF-8 and parses the result as JSON.
It returns `null` when reading or parsing throws. Stored JSON `null` produces
the same result, so use `source.read` directly when the distinction matters.

`writeJsonFile` calls `JSON.stringify(value, null, 2)`, appends a newline,
encodes the text as UTF-8 and writes it through the source.

## Filesystem defaults

`DEFAULT_IGNORED_PATHS` contains the globs used by `FilesystemAssetSource`.
See [Filesystem persistence](./Filesystem.md#ignored-paths) for the values and
matching behavior.
