---
"@jolly-pixel/controls": minor
"@jolly-pixel/network": minor
"@jolly-pixel/voxel.renderer": minor
---

`Mouse` tracks whether the pointer sits over the canvas as `hovering`, with
`enter` and `leave` events, so a consumer can tell a live `position` from the
stale one left behind when the pointer moves onto surrounding UI.
`SyncAdapter.notifyLocal()` replays an event to the handler captured at
`attach()`, which `VoxelSyncClient` now uses so a peer's edit reaches local
observers, and hiding, showing or removing a layer marks every layer's chunks
dirty for cross-layer face culling.
