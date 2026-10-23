---
"@jolly-pixel/asset-source": major
---

`read` rejects with `AssetPathNotFoundError` on every source, the filesystem `exists` reports `false` for a directory, and `readJsonFile` rethrows failures other than a missing file or invalid JSON.
`AssetSource.isIgnored` is required (memory and IndexedDB ignore `.jollypixel/`); `FilesystemAssetSource.resolve` and the `toRelativePosix` export are removed.
Filesystem paths that reach an ignored folder through a link or a Windows short name are rejected, the watcher no longer follows symlinks, and the HTTP handler sends a sandboxing `Content-Security-Policy`.
