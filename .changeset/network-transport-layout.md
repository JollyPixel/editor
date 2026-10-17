---
"@jolly-pixel/network": major
"@jolly-pixel/accounts": patch
---

Transports decode the credential into `request.credential`; `readCredential` and `InvalidCredentialError` are gone, and a malformed WebSocket credential is refused with `4401` before any provider runs.
`Server.connect` takes a `ClientConnection` (`id`, `sendSerialized`, `close`) and serializes every message itself; extensions still receive `ClientHandle`. `isChannelTransportMessage` and `ChannelTransportMessage` are no longer exported.
