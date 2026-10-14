---
"@jolly-pixel/network": minor
---

Add `DataChannelPort`, which carries the channel transport over an `RTCDataChannel` in bounded frames with backpressure.
`ChannelTransport` takes a `credential` and passes it to the host's `open(options)`, typed `SocketConnectOptions`.
`LoopbackTransport.connect(options)` puts it on the authentication attempt, and `readCredential` prefers it over the handshake.
