# API reference

`@jolly-pixel/network` is the transport-agnostic layer the collaborative
editors share: a client, a server, rooms, and the extension protocol that binds
a feature to a room. [ARCHITECTURE.md](../ARCHITECTURE.md) explains how the
pieces fit together; the pages below are the contract for each one.

## Core

- [Client](./Client.md) — connecting, and obtaining a `Room`.
- [Server](./Server.md) — hosting rooms and dispatching envelopes.
- [Extension](./Extension.md) — declaring the inbound/outbound protocols of a feature.
- [Rights](./Rights.md) — the role-based table gating both directions.
- [Transports](./Transports.md) — the transport port, and the WebSocket implementation.

## Synchronisation

- [SyncAdapter](./sync/SyncAdapter.md) — the shared command header and replication contract.
- [Conflicts](./sync/Conflicts.md) — the conflict resolver and its last-write-wins default.
