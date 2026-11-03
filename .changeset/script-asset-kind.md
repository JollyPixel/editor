---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/network": minor
---

Add `AssetLiveProtocol.authorRebases`, which skips the author's correction for kinds whose clients transform edits themselves, and a `reloaded()` hook called before a reload snapshot. `CommandSync` exposes its guarded `resync()` to subclasses.
