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
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";

const source = new FilesystemAssetSource("./assets", {
  ignore: ["generated/**"]
});
```

`root` is exposed as an absolute path. The directory may be missing when the
source is created: `list()` returns an empty array, and the first `write`
creates the required directories.

Writes replace a file through a temporary file and rename. An interrupted
write leaves the previous file readable, and temporary files are excluded from
listings.

`writeIfAbsent()` writes a temporary file and then links it into place. The
link fails when the destination is occupied, so concurrent conditional writes
cannot replace each other. Filesystems without hard-link support reject this
operation. `exists()` checks the path without reading the file.

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

Ignored paths are excluded from `list()` and `watch()`. Direct `read`, `write`
and `delete` calls can still use them. `isIgnored(path)` applies the same
matcher without accessing the filesystem.

## Watching

```ts
const stop = source.watch((path) => {
  console.log(path);
});

stop();
```

The callback receives the same root-relative POSIX path for additions,
changes and removals. Existing files are also reported when the watcher starts.
The callback does not receive the event kind, so callers should read or list
the source when they need the current state.

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
[`AssetSource`](./AssetSource.md) contract.
