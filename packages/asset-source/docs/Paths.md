# Paths

The package entry point exports helpers that validate asset paths, guard
reserved locations and track folders.

Asset paths are root-relative POSIX strings. The validators normalize
backslashes, repeated separators and inner `.` or `..` segments.

## `safeAssetPath`

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
| `reserved` | a segment with `:`, a trailing dot or space, or a Windows device name (`CON`, `nul.png`) |

The rules come from `safePath` in `@openally/servo/paths` and apply on every
platform. `writableAssetPath` also returns `reserved` for a valid path inside
`.jollypixel/` or a path the source ignores.

## `normalizeAssetPath`

```ts
normalizeAssetPath(input: string): string
```

Returns the same normalized value as `safeAssetPath`. A rejected input throws
`AssetPathEscapeError`.

```ts
const path = normalizeAssetPath("textures\\tiles\\../grass.png");
// "textures/grass.png"
```

## `writableAssetPath`

```ts
writableAssetPath(
  source: Pick<AssetSource, "isIgnored">,
  input: string
): Result<string, AssetPathEscapeError>
```

Returns the normalized path in an `Ok` when a client may create a file or
folder there. An unsafe input fails with the `safeAssetPath` reason. A
normalized path in the state directory or one that `source.isIgnored` matches
fails with `reserved`, so `./.git\config` is refused like `.git/config`.

```ts
const path = writableAssetPath(source, "node_modules/kind/index.js");
// Err(AssetPathEscapeError), reason "reserved" on a FilesystemAssetSource
```

## `AssetPathEscapeError`

```ts
class AssetPathEscapeError extends Error {
  readonly path: string;
  readonly reason: AssetPathRejection;
}
```

`path` contains the rejected input. `reason` contains the rejection reported
by `safeAssetPath`, or a policy reason supplied by the caller.

## `AssetPathNotFoundError`

```ts
class AssetPathNotFoundError extends Error {
  readonly path: string;
}
```

Every built-in source rejects `read` with this error when no file exists at
`path`. The filesystem source keeps the underlying Node.js error as `cause`.

## Folder paths

```ts
class FolderSet implements Iterable<string> {
  constructor(folders?: Iterable<string>);
  readonly size: number;
  has(folder: string): boolean;
  add(folder: string): this;
  addParents(assetPath: string): this;
  subtree(root: string): string[];
  prune(root: string, files: Iterable<string>): string[];
  equals(other: FolderSet): boolean;
  toJSON(): string[];
}

isWithinFolder(path: string, folder: string): boolean
```

A `FolderSet` holds normalized folder paths and always holds the parents of
each folder it holds. `add` adds a folder with its parents, and `addParents`
adds the folders above a path: `"maps/world/a.json"` adds `"maps"` and
`"maps/world"`. The set is mutable.

- `subtree(root)` returns `root` and the folders under it, sorted.
- `prune(root, files)` removes the folders of `subtree(root)` that hold none
  of `files`, at any depth, and returns them sorted.
- `equals` compares contents, and `toJSON()` returns the sorted paths.

`isWithinFolder` reports whether a normalized path is `folder` or lies
anywhere below it.

## State directory

```ts
const STATE_DIRECTORY = ".jollypixel";
isStatePath(assetPath: string): boolean
```

`isStatePath` matches the state directory itself and its children at the source
root. Matching is case-insensitive. A nested path such as
`textures/.jollypixel/state.json` is an ordinary asset path.

`safeAssetPath` and `normalizeAssetPath` accept state paths. The built-in
sources keep them readable and writable while excluding them from `list()`.
