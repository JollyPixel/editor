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
type NetworkEnvelope =
  | { namespace: string; kind: "join"; }
  | { namespace: string; kind: "leave"; }
  | { namespace: string; kind: "message"; payload: unknown; }
  | { namespace: string; kind: "peer-joined"; clientId: string; }
  | { namespace: string; kind: "peer-left"; clientId: string; };
```

`join`/`leave`/`message` travel client → server; `peer-joined`/`peer-left` travel server → client.

`NetworkServer` reads the envelope to route messages and track namespace membership; `NetworkClient` does the mirror job client-side.

A [`NetworkChannel`](./docs/NetworkChannel.md)/ [`NetworkPlugin`](./docs/NetworkPlugin.md) never sees the envelope itself, only `payload`.

## Connection lifecycle

1. `NetworkClient.channel(namespace)` sends a `"join"` envelope and returns a `NetworkChannel`.
2. `NetworkServer` records the client as a member of that namespace,
   broadcasts `"peer-joined"` to the namespace's other members, then calls
   the matching `NetworkPlugin.onClientConnect()`.
3. `channel.send(payload)` / `plugin`'s scoped `client.send(payload)`
   exchange `"message"` envelopes, routed by namespace.
4. `channel.leave()` (or a socket disconnect) removes the client from the
   namespace, broadcasts `"peer-left"`, and calls
   `NetworkPlugin.onClientDisconnect()`.

See [docs/](./docs/) for per-module API reference.
