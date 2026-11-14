---
"@jolly-pixel/asset-server": patch
---

`AssetServer.open` writes its `seed` only into a project that holds no document yet, so a deleted seed asset no longer comes back on the next start.
