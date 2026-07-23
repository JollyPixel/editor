# Network Sync Layer

Transport-agnostic, server-authoritative multiplayer for `PixelArtCanvas`. Multiple
clients can share the same texture in real time. Structurally mirrors
`@jolly-pixel/voxel.renderer`'s network layer but is an independent
implementation: this package has no dependency on voxel-renderer.

## Architecture

```
┌───────────────┐  onBufferUpdated   ┌──────────────────┐   sendCommand   ┌─────────────┐
│ PixelArtCanvas │───────────────────▶│ PixelSyncSession │────────────────▶│  Transport  │
│               │                    │  (one buffer)    │◀────────────────│ (WebSocket, │
│               │◀──applyRemote──────│                  │   onCommand     │ WebRTC, ...) │
└───────────────┘                    └──────────────────┘                 └──────┬──────┘
                                                                                  │ wire
                                                                                  ▼
                                                                       ┌──────────────────┐
                                                                       │  PixelSyncServer │
                                                                       │    (headless)    │
                                                                       │   one PixelBuffer│
                                                                       └──────────────────┘
```

Each `PixelSyncServer` owns exactly one [`PixelBuffer`](../buffer/PixelBuffer.md)
and is registered under its own `NetworkPlugin` namespace. A `PixelArtCanvas`
has no concept of a buffer identity either — it owns exactly one texture, and
[`PixelSyncSession`](./PixelSyncSession.md) attaches it to a transport that is
already scoped to that one buffer's namespace. Syncing several buffers (e.g.
multiple open tilesets) means running one `PixelSyncServer` instance and one
transport/session pair per buffer, each under its own namespace — see
[`PixelSyncServer`](./PixelSyncServer.md) for how namespaces are assigned.
Registration is currently static (instances are constructed up front); dynamic
buffer creation/discovery is a future extension.

**Flow:**
1. A local mutation (a paint stroke, fill, resize, setting `texture`, or a UV
   region create/delete/move) fires `PixelArtCanvas.onBufferUpdated` (see
   [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)). `attach()` chains onto
   whatever handler was already set on the canvas rather than replacing it, so
   a consumer's own local reaction keeps firing once sync is layered on.
2. `PixelSyncSession` stamps the event with `clientId` / `seq` / `timestamp`
   and calls `transport.sendCommand(cmd)`.
3. The transport delivers the command to [`PixelSyncServer.receive()`](./PixelSyncServer.md).
4. The server resolves conflicts (see [ConflictResolver](./ConflictResolver.md)), applies the command to its authoritative
   `PixelBuffer`, and broadcasts it to every client connected to that namespace.
5. Each connected client's transport calls `onCommand(cmd)`, which
   `PixelSyncSession` routes to `PixelArtCanvas.applyRemoteCommand()`.
6. `applyRemoteCommand` suppresses `onBufferUpdated` while applying, so the
   result is never re-broadcast: no echo loop.

A client receives the buffer's pixel data as soon as it connects: `PixelSyncServer`
pushes a snapshot immediately in `onClientConnect`, before any command flows.

## Pieces

| Module | Description |
|---|---|
| [types](./types.md) | `PixelNetworkCommand` wire format and its constituent event types |
| [PixelTransport](./PixelTransport.md) | Transport-agnostic interface consumers implement (WebSocket, WebRTC, ...) |
| [PixelSyncSession](./PixelSyncSession.md) | Client-side orchestrator for one buffer |
| [PixelSyncServer](./PixelSyncServer.md) | Headless, server-authoritative sync manager for one buffer |
| [PixelCommandApplier](./PixelCommandApplier.md) | `applyCommandToBuffer`, headless command replay |
| [ConflictResolver](./ConflictResolver.md) | Per-pixel conflict resolution strategy (`LastWriteWinsResolver` and custom resolvers) |
