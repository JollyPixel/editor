# AssetSource

`AssetSource` stores asset bytes under root-relative paths. The built-in
[memory](./Memory.md) and [filesystem](./Filesystem.md) sources follow the same
storage contract.

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

## Storage contract

- `read(path)` returns the bytes stored at `path` and rejects when the asset is
  missing.
- `write(path, data)` creates the asset or replaces its current contents.
- `delete(path)` removes the asset. A missing asset is left alone.
- `list()` returns sorted, root-relative POSIX paths.

The `.jollypixel/` state directory is excluded from `list()`. It remains
available to `read`, `write` and `delete` so applications can keep their state
beside the assets.

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
