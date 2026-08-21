# AssetSource

`AssetSource` is the physical store used by the backend.

```ts
interface AssetSource {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array): Promise<void>;
  delete(path: string): Promise<void>;
  list(): Promise<string[]>;
  watch?(onChange: (path: string) => void): () => void;
}
```

Paths are root-relative POSIX strings. Backslashes are normalized. Absolute
paths, empty paths and traversal outside the root throw
`AssetPathEscapeError`. `delete` does nothing when the path is missing, and
`list` returns sorted paths without `.jollypixel/` state files.

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

The `ignore` option adds globs to these defaults:

```ts
[
  ".jollypixel/**",
  ".git/**",
  "node_modules/**",
  "dist/**"
]
```

`isIgnored(path)` tests the configured globs. `watch(callback)` reports
root-relative POSIX paths and returns a function that stops the watcher.
