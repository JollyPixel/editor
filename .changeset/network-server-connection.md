---
"@jolly-pixel/network": major
---

`Server.connect(client, identity)` returns a `ServerConnection` with `receive(raw)` and an idempotent `close()`, replacing `handleConnect`, `handleMessage` and `handleDisconnect`; a closing connection drops the envelopes it still receives.
A member whose `onClientConnect` throws now leaves its room on disconnect, so peers get `peer-left` and the room can be evicted.
