---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": patch
---

A rights table now denies unmatched keys; end a role with `"*": "write"` to keep it open. `WebsocketTransport` checks Host and Origin headers, caps payloads, terminates slow or silent sockets, and no longer crashes when a client resets during authentication.
`PasswordAuthentication` limits failed attempts per address, `ServerOptions.limits` bounds presence size and resync rate, and `attributeCommand` stamps command headers on the server.
