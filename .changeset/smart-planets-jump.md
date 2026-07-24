---
"@jolly-pixel/network": minor
---

Add peer identity and presence metadata. `NetworkClient` now supports connection-wide `identity`, and `NetworkChannel` now adds `updatePresence(patch)`, `onPeerPresence`, and a synced `peers` map (including initial `sync` state).
