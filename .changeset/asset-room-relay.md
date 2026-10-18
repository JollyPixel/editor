---
"@jolly-pixel/asset-server": minor
---

`AssetLiveProtocol` gains an optional `relay` (`AssetRelay`, `AssetRelaySchemas`) that receives ephemeral client messages outside arbitration and the event log, and is told when a member leaves.
A live room whose resolution fails now releases the asset state it acquired.
