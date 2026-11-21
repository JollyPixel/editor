---
"@jolly-pixel/asset-server": minor
---

`AssetRoomBinding` requires `path()` and `readFile(path)`, so a live room can read project files such as `.editorconfig`; reserved paths read as `null`.
`./testing` adds `roomBinding()` for hand-built bindings, and `LiveAssetRoom` accepts `{ path, files }`.
