---
"@jolly-pixel/network": minor
---

`ChannelTransport` and `ChannelTransportHost` accept a `socketPort` factory that gives each socket its own port, so a shared `BroadcastChannel` only carries connect messages.
The host follows each client's choice and closes a socket it cannot give a port with code `1002`.
