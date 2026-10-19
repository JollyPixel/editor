---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/engine": patch
---

`AssetLiveProtocol` gains an optional `relay` for ephemeral client messages outside arbitration and the event log; a live room that fails to open releases its state.
`OrbitFlyCamera.teleport()` keeps the camera at the pose in "elastic" focus mode and releases a "lock" orbit, instead of being pulled back on the next frame.
