# Architecture

This document describes how `@jolly-pixel/network` multiplexes multiple features over a single transport connection.

## High-level overview

```
Browser                                  Server
┌──────────────┐   channel.send()   ┌──────────────────┐   onMessage    ┌───────────────┐
│ NetworkClient│───────────────────▶│ WebsocketTransport│──────────────▶│ NetworkServer │
│  .channel()  │◀───────────────────│  (ws upgrade,     │◀───────────────│  (namespace   │
└──────────────┘  onMessage/Peer*   │   client framing) │   broadcast    │   routing)    │
                                     └──────────────────┘                └───────┬───────┘
                                                                                  │ dispatch
                                                                                  ▼
                                                                         ┌────────────────┐
                                                                         │ NetworkPlugin  │
                                                                         │ (per namespace)│
                                                                         └────────────────┘
```

`NetworkServer` and `NetworkClient` are the transport's registration point: unrelated features (pixel-art sync, voxel sync, ...) each register a [`NetworkPlugin`](./docs/NetworkPlugin.md) under their own namespace and share one socket/port without knowing about each other.

## Wire format

Every message travels wrapped in a `NetworkEnvelope`:

```ts
type PeerMetadata = Record<string, unknown>;

type NetworkEnvelope =
  | { namespace: string; kind: "join"; identity?: PeerMetadata; }
  | { namespace: string; kind: "leave"; }
  | { namespace: string; kind: "message"; payload: unknown; }
  | { namespace: string; kind: "presence"; patch: PeerMetadata; }
  | { namespace: string; kind: "sync"; members: PeerInfo[]; }
  | { namespace: string; kind: "peer-joined"; clientId: string; identity: PeerMetadata; }
  | { namespace: string; kind: "peer-left"; clientId: string; }
  | { namespace: string; kind: "peer-presence"; clientId: string; patch: PeerMetadata; };
```

`join`/`leave`/`message`/`presence` travel client → server; `sync`/`peer-joined`/`peer-left`/`peer-presence` travel server → client (`sync` is unicast to the joining client only, the other three are broadcast).

`join.identity` is connection-wide static metadata (e.g. a username), set once on `NetworkClient` and resent on every namespace it joins. `presence.patch` is per-namespace dynamic metadata (e.g. cursor position): shallow-merged into that client's stored state on the server, then relayed to the rest of the namespace as `peer-presence`. `sync` bootstraps a newly-joined client with every pre-existing member's current `{ identity, presence }`, so it doesn't have to wait for further events to know who's already there.

`NetworkServer` reads the envelope to route messages and track namespace membership + per-member identity/presence; `NetworkClient` does the mirror job client-side, exposing it as `channel.peers`.

A [`NetworkChannel`](./docs/NetworkChannel.md)/ [`NetworkPlugin`](./docs/NetworkPlugin.md) never sees the envelope itself, only `payload`/`patch`/`identity`.

## Connection lifecycle

1. `NetworkClient.channel(namespace)` sends a `"join"` envelope (carrying the client's `identity`) and returns a `NetworkChannel`.
2. `NetworkServer` broadcasts `"peer-joined"` to the namespace's other members, unicasts a `"sync"` snapshot of them back to the joiner, records the client as a member, then calls the matching `NetworkPlugin.onClientConnect()`.
3. `channel.send(payload)` / `plugin`'s scoped `client.send(payload)`
   exchange `"message"` envelopes, routed by namespace.
4. `channel.updatePresence(patch)` exchanges `"presence"`/`"peer-presence"` envelopes, merged and relayed by `NetworkServer` — plugins aren't involved.
5. `channel.leave()` (or a socket disconnect) removes the client from the
   namespace (discarding its identity/presence), broadcasts `"peer-left"`, and calls
   `NetworkPlugin.onClientDisconnect()`.

See [docs/](./docs/) for per-module API reference.
