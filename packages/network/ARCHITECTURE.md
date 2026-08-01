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
                                                                         │   Extension    │
                                                                         │  (per room)    │
                                                                         └────────────────┘
```

`Server` and `Client` are the transport's registration point: unrelated features (pixel-art sync, voxel sync, ...) each register an `Extension` under their own room name and share one socket/port without knowing about each other.

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
  | { room: string; kind: "peer-presence"; clientId: string; patch: PeerMetadata; }
  | { room: string; kind: "denied"; event: string; reason: string; }
  | { room: string; kind: "error"; event: string; reason: string; };
```

`join`/`leave`/`message`/`presence` travel client → server; `sync`/`peer-joined`/`peer-left`/`peer-presence`/`denied`/`error` travel server → client (`sync`, `denied`, and `error` are unicast to a single client, the others are broadcast).

`denied` and `error` share a shape but not a meaning: `denied` is a rights rejection, `error` an infrastructure failure reported by server-side extension flow. They stay distinct kinds so a client can tell "you're not allowed to do that" apart from "that failed, maybe retry".

`join.identity` is connection-wide static metadata (e.g. a username), set once on `Client` and resent on every room it joins. `presence.patch` is per-room dynamic metadata (e.g. cursor position): shallow-merged into that client's stored state on the server, then relayed to the rest of the room as `peer-presence`. `sync` bootstraps a newly-joined client with every pre-existing member's current `{ identity, presence }`, so it doesn't have to wait for further events to know who's already there.

`Server` reads the envelope to route messages and track room membership + per-member identity/presence; `Client` does the mirror job client-side, exposing it as `room.peers`.

A `Room`/`Extension` never sees the envelope itself, only `payload`/`patch`/`identity`.

## Connection lifecycle

1. `Client.room(name)` returns a `Room` without joining it. `room.join()` sends the `"join"` envelope carrying the client's `identity`; repeated calls are a no-op once joined.
2. The server resolves a role from `identity.role` and checks `${extension.name}.$join`. If denied, a unicast `"denied"` envelope goes back and the client is never recorded as a member. Otherwise it broadcasts `"peer-joined"` to the other members, unicasts a `"sync"` snapshot of them to the joiner, records the membership, then calls `Extension.onClientConnect()`.
3. `room.send(payload)` and the extension's scoped `client.send(payload)` exchange `"message"` envelopes, routed by room and gated on `${extension.name}.${event}`.
4. `room.updatePresence(patch)` exchanges `"presence"`/`"peer-presence"` envelopes, merged and relayed by the server, gated on `${extension.name}.$presence`. Extensions aren't involved.
5. `room.leave()` or a socket disconnect drops the client from the room, discarding its identity/presence, broadcasts `"peer-left"`, and calls `Extension.onClientDisconnect()`. Never gated.

See [docs/](./docs/) for the API reference, and [docs/Rights.md](./docs/Rights.md) for the rights model the gating above relies on.
