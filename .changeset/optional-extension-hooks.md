---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": patch
"@jolly-pixel/pixel-draw.renderer": patch
"@jolly-pixel/voxel.renderer": patch
---

`Extension.onClientConnect`, `onClientDisconnect` and `onMessage` are now
optional; the room skips a hook it does not find and drops such a message with a
`debug` log. Implementations need the `override` modifier, as `dispose` already
did, and a worker extension reports its hooks at ready time so an omitted one
costs no RPC round-trip.
