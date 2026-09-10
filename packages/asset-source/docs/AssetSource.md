# AssetSource

`AssetSource` stores asset bytes under root-relative paths. The built-in
[memory](./Memory.md) and [filesystem](./Filesystem.md) sources follow the same
storage contract.

```ts
interface AssetSource {
  read(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  write(path: string, data: Uint8Array): Promise<void>;
  writeIfAbsent(path: string, data: Uint8Array): Promise<boolean>;
  delete(path: string): Promise<void>;
  list(): Promise<string[]>;
  isIgnored?(path: string): boolean;
  watch?(onChange: (path: string) => void): () => void;
}
```

## Storage contract

- `read(path)` returns the bytes stored at `path` and rejects when the asset is
  missing.
- `exists(path)` reports whether `path` is occupied without reading its bytes.
- `write(path, data)` creates the asset or replaces its current contents.
- `writeIfAbsent(path, data)` atomically creates the asset and returns `true`.
  It returns `false` without changing the asset when the path is occupied.
- `delete(path)` removes the asset. A missing asset is left alone.
- `list()` returns sorted, root-relative POSIX paths.

The result of `exists()` is a snapshot. A later operation may observe a
different state. Use `writeIfAbsent()` when an existing asset must not be
replaced by a concurrent writer.

The `.jollypixel/` state directory is excluded from `list()`. Direct storage
operations remain available there so applications can keep their state beside
the assets.

## Optional capabilities

`isIgnored(path)` reports whether a path is hidden from listing and watching.
Code accepting any `AssetSource` must check that the method exists before
calling it.

`watch(onChange)` calls `onChange` with a root-relative POSIX path when that
asset may have changed. It returns a function that stops watching. Support is
optional; the in-memory source does not provide it.

## Paths

Paths use `/` separators and are relative to the source root. Backslashes are
normalized, and inner `.` or `..` segments collapse. Empty paths, absolute
paths and paths that escape the root are rejected.

Use [`safeAssetPath`](./Utilities.md#safeassetpath) when validating untrusted
input. The full set of path and state-directory helpers is documented under
[Utilities](./Utilities.md#asset-paths).
