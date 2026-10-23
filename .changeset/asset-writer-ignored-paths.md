---
"@jolly-pixel/asset-server": major
---

`AssetWriter` now requires a `source` option. Asset create, rename and import, and the catalog create-folder and move-folder commands, refuse a path the source ignores (`.git/`, `node_modules/`, `dist/` and custom globs) with a `reserved` `AssetPathEscapeError`.
Before, a catalog client could write files there, such as a git hook or a kind package the server imports.
