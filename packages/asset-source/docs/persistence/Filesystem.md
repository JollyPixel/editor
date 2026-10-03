# Filesystem persistence

`FilesystemAssetSource` stores assets below a directory on the local
filesystem. It is available in Node.js.

```ts
new FilesystemAssetSource(
  root: string,
  options?: FilesystemAssetSourceOptions
)

interface FilesystemAssetSourceOptions {
  ignore?: readonly string[];
}
```

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";

const source = new FilesystemAssetSource("./assets", {
  ignore: ["generated/**"]
});
```

`root` is exposed as an absolute path. The directory may be missing when the
source is created: `list()` returns an empty array, and the first `write`
creates the required directories.

A file is replaced through a temporary sibling that is flushed to disk and then
renamed, so an interrupted write leaves the previous file readable. Temporary
files are excluded from listings.

`writeIfAbsent()` links the temporary file into place. The link fails when the
destination is occupied, so concurrent conditional writes cannot replace each
other. Filesystems without hard-link support reject this operation. `exists()`
checks the path without reading the file.

## Ignored paths

The `ignore` option adds case-insensitive globs to `DEFAULT_IGNORED_PATHS`:

```ts
[
  ".jollypixel/**",
  ".git/**",
  "node_modules/**",
  "dist/**"
]
```

Ignored paths are excluded from `list()`, `folders()` and `watch()`. Direct
`read`, `write` and `delete` calls can still use them. `isIgnored(path)` applies the same
matcher without accessing the filesystem.

## Watching

```ts
const stop = source.watch(
  (path, type) => console.log(type, path),
  { onReady: () => console.log("watching") }
);

stop();
```

The callback receives the same root-relative POSIX path for additions,
changes and removals of files and folders. Entries that already exist when the
watcher starts are not reported, and neither are the temporary files of
atomic writes. `onReady` is called once the initial scan is done; a change
made before it may go unreported.
`type` is `"file"` or `"folder"`. The callback does not say whether the entry
was added, changed or removed, so callers should read or list the source when
they need the current state.

## Folders

Folders are directories. `folders()` lists every directory under `root` that
is not ignored. `deleteFolder` removes the empty directories of the subtree,
deepest first, and leaves any directory that still holds an entry, an ignored
file included.

## Resolving paths

```ts
source.root: string
source.resolve(path: string): string
```

`resolve(path)` validates the asset path and joins it to `root`. It does not
access the filesystem.

`read`, `write` and `delete` also check filesystem links. They throw
`AssetPathEscapeError` when a symbolic link or junction would take the
operation outside `root`.

The remaining read, write, delete and list behavior follows the shared
[`AssetSource`](../../README.md#assetsource) contract.
