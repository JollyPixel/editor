# API reference

`@jolly-pixel/network` is the transport-agnostic layer the collaborative
editors share: a client, a server, rooms, and the extension protocol that binds
a feature to a room. [ARCHITECTURE.md](../ARCHITECTURE.md) explains how the
pieces fit together; the pages below are the contract for each one.

## Core

- [Client](./Client.md) — connecting, and obtaining a `Room`.
- [PresenceChannel](./PresenceChannel.md): one typed presence field per peer.
- [Server](./Server.md) — hosting rooms and dispatching envelopes.
- [Extension](./Extension.md) — declaring the inbound/outbound protocols of a feature.
- [Authentication](./Authentication.md) — deciding who a connection is.
- [Rights](./Rights.md) — the role-based table gating both directions.
- [Transports](./Transports.md) — the transport port, and the WebSocket implementation.

## Synchronisation

- [CommandSync](./sync/CommandSync.md): stamped commands, snapshots and server notices over a room.
- [Conflicts](./sync/Conflicts.md) — the conflict resolver and its last-write-wins default.
