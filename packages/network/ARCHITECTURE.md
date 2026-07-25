# Architecture

This document describes how `@jolly-pixel/network` multiplexes multiple features over a single transport connection.

## High-level overview

```
Browser                                  Server
┌──────────────┐    room.send()     ┌──────────────────┐   onMessage    ┌───────────────┐
│    Client    │───────────────────▶│ WebsocketTransport│──────────────▶│    Server     │
│   .room()    │◀───────────────────│  (ws upgrade,     │◀───────────────│  (room        │
└──────────────┘  onMessage/Peer*   │   client framing) │   broadcast    │   routing)    │
                                     └──────────────────┘                └───────┬───────┘
                                                                                  │ dispatch
                                                                                  ▼
                                                                         ┌────────────────┐
                                                                         │ RoomAuthority  │
                                                                         │  (per room)    │
                                                                         └────────────────┘
```

`Server` and `Client` are the transport's registration point: unrelated features (pixel-art sync, voxel sync, ...) each register a `RoomAuthority` under their own room name and share one socket/port without knowing about each other.

## Wire format

Every message travels wrapped in an `Envelope`:

```ts
type PeerMetadata = Record<string, unknown>;

type Envelope =
  | { room: string; kind: "join"; identity?: PeerMetadata; }
  | { room: string; kind: "leave"; }
  | { room: string; kind: "message"; payload: unknown; }
  | { room: string; kind: "presence"; patch: PeerMetadata; }
  | { room: string; kind: "sync"; members: Peer[]; }
  | { room: string; kind: "peer-joined"; clientId: string; identity: PeerMetadata; }
  | { room: string; kind: "peer-left"; clientId: string; }
  | { room: string; kind: "peer-presence"; clientId: string; patch: PeerMetadata; };
```

`join`/`leave`/`message`/`presence` travel client → server; `sync`/`peer-joined`/`peer-left`/`peer-presence` travel server → client (`sync` is unicast to the joining client only, the other three are broadcast).

`join.identity` is connection-wide static metadata (e.g. a username), set once on `Client` and resent on every room it joins. `presence.patch` is per-room dynamic metadata (e.g. cursor position): shallow-merged into that client's stored state on the server, then relayed to the rest of the room as `peer-presence`. `sync` bootstraps a newly-joined client with every pre-existing member's current `{ identity, presence }`, so it doesn't have to wait for further events to know who's already there.

`Server` reads the envelope to route messages and track room membership + per-member identity/presence; `Client` does the mirror job client-side, exposing it as `room.peers`.

A [`Room`](./docs/Room.md)/`RoomAuthority` never sees the envelope itself, only `payload`/`patch`/`identity`.

## Connection lifecycle

1. `Client.room(name)` sends a `"join"` envelope (carrying the client's `identity`) and returns a `Room`.
2. `Server` broadcasts `"peer-joined"` to the room's other members, unicasts a `"sync"` snapshot of them back to the joiner, records the client as a member, then calls the matching `RoomAuthority.onClientConnect()`.
3. `room.send(payload)` / the authority's scoped `client.send(payload)`
   exchange `"message"` envelopes, routed by room.
4. `room.updatePresence(patch)` exchanges `"presence"`/`"peer-presence"` envelopes, merged and relayed by `Server`  authorities aren't involved.
5. `room.leave()` (or a socket disconnect) removes the client from the
   room (discarding its identity/presence), broadcasts `"peer-left"`, and calls
   `RoomAuthority.onClientDisconnect()`.

See [docs/](./docs/) for per-module API reference.
