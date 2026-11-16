---
"@jolly-pixel/network": minor
---

`WebsocketTransport` takes upgrades handed to `handleUpgrade`, and needs no `httpServer` or `path` when another listener routes upgrades to it.
`connectWebSocket` accepts a `URL`, and turns an http: or https: URL into ws: or wss:.
