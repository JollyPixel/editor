---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/pixel-draw.renderer": minor
"@jolly-pixel/controls": minor
"@jolly-pixel/loop": minor
"@jolly-pixel/engine": minor
"@jolly-pixel/runtime": minor
"@jolly-pixel/three": minor
"@jolly-pixel/voxel.renderer": minor
---

Add `renderOnDemand` to `Runtime`, built on `GameLoop` `keepAlive`/`invalidate()` (sleeps after `trailingRenders`) and `FrameScheduler.skipGap()`, with `invalidate()`/`keepAlive()` on the engine `World` and `wasActive` on the controls `Input`.
`OrbitFlyCamera`, `VoxelRenderer` (new `VoxelView` `requestFrame`) and `PeerFrustumSync` (new `requestFrame`, trailing pose publish) now request the frames they need.
Joins receive a cached `encodeSnapshot()` form (PNG pixels: 2.7 MB to 165 KB for a 1024x512 tileset) that `CommandSync.applySnapshot` loads in order; a cold asset room restores its arbiter from the replay, and rooms share compiled validators through `MessageParser.of`.
