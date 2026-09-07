# AssetSource

`AssetSource` is the physical store used by the backend.

```ts
interface AssetSource {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
  list(): Promise<string[]>;
  isIgnored?(path: string): boolean;
  watch?(onChange: (path: string) => void): () => void;
}
```

`delete` does nothing when the path is missing, and `list` returns sorted
paths without `.jollypixel/` state files. `isIgnored(path)` reports what the
source hides from listing and watching; a caller exposing the source to the
outside, the [static handler](./Workspace.md#serving-the-workspace) above
all, must answer as if the path did not exist.

## Paths

Paths are root-relative POSIX strings. Backslashes are normalized, and inner
`.`/`..` segments collapse.

```ts
safeAssetPath(input: string): Result<string, AssetPathRejection>
normalizeAssetPath(input: string): string
isStatePath(assetPath: string): boolean
```

`safeAssetPath` validates untrusted input and reports why it refused;
`normalizeAssetPath` throws `AssetPathEscapeError`, whose `reason` carries
the same value.

| Rejection | Input |
|---|---|
| `empty` | `""` |
| `invalid` | a control character, `NUL` included |
| `absolute` | `/etc/passwd`, `C:/Windows/win.ini`, `\\server\share` |
| `traversal` | `..`, `../secret`, `textures/../../secret` |
| `directory` | `.`, `textures/` |
| `reserved` | a writer naming the `.jollypixel/` state directory |

`isStatePath` matches the state directory case-insensitively, because a
case-insensitive filesystem answers `.JOLLYPIXEL/state.json` from
`.jollypixel/`.

## MemoryAssetSource

```ts
new MemoryAssetSource(files?: Iterable<readonly [string, Uint8Array]>)
```

The memory source copies bytes on input and output. It does not implement
`watch()` and is intended for tests or in-process hosts.

## FilesystemAssetSource

```ts
new FilesystemAssetSource(root: string, options?: {
  ignore?: readonly string[];
})
```

Writes use a temporary file followed by a rename. The source creates parent
directories as needed and watches file additions, changes and removals with
chokidar.

The root may not exist yet: `list()` then returns an empty array and the first
`write` creates it.

The `ignore` option adds globs to these defaults:

```ts
[
  ".jollypixel/**",
  ".git/**",
  "node_modules/**",
  "dist/**"
]
```

Globs are matched case-insensitively, so `.GIT/config` is ignored like
`.git/config` on a case-insensitive filesystem. `watch(callback)` reports
root-relative POSIX paths and returns a function that stops the watcher.

`resolve(path)` joins the root lexically. `read`, `write` and `delete`
additionally resolve the real path of the target, or of its closest existing
parent, and throw `AssetPathEscapeError` when a symlink takes it out of the
root.
