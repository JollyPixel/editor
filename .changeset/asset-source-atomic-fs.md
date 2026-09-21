---
"@jolly-pixel/asset-source": patch
---

Delegate `FilesystemAssetSource` atomic writes to `@openally/atomic-fs`, which flushes to disk and retries transient Windows errors.
Only files named like atomic-fs temporary files are now hidden from `list()`.
