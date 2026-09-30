---
"@jolly-pixel/network": minor
---

`WebsocketTransport` and the Vite plugin accept `compression` to negotiate permessage-deflate. Rooms serialize a fanned-out message once for handles implementing `ClientHandle.sendSerialized`.
Server messages gain `{ type: "correction", data }`, which `CommandSync` emits as a command, then replays the client's later echoes on top of it.
