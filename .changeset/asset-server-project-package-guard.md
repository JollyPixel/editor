---
"@jolly-pixel/asset-server": minor
---

`PackageResolver.ignoreGlobs()` lists the root `package.json` and the local package folders to pass as the new `AssetServer` `ignore` option.
Folder delete and move refuse reserved paths, and `__proto__` is no longer a valid part ID.
