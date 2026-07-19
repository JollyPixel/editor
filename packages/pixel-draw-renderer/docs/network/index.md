# Network Sync Layer

Transport-agnostic, server-authoritative multiplayer for `PixelArtCanvas`. Multiple
clients can share the same texture(s) in real time. Structurally mirrors
`@jolly-pixel/voxel.renderer`'s network layer but is an independent
implementation: this package has no dependency on voxel-renderer.

## Architecture

```
┌───────────────┐  onBufferUpdated   ┌──────────────────┐   sendCommand   ┌─────────────┐
│ PixelArtCanvas │───────────────────▶│ PixelSyncSession │────────────────▶│  Transport  │
│  (per buffer) │                    │  (multi-buffer)  │◀────────────────│ (WebSocket, │
│               │◀──applyRemote──────│                  │   onCommand     │ WebRTC, ...) │
└───────────────┘                    └──────────────────┘                 └──────┬──────┘
                                                                                  │ wire
                                                                                  ▼
                                                                       ┌──────────────────┐
                                                                       │  PixelSyncServer │
                                                                       │    (headless)    │
                                                                       │    PixelWorld    │
                                                                       └──────────────────┘
```

A `PixelArtCanvas` has no concept of a buffer identity; it owns exactly one
texture. [`PixelSyncSession`](./PixelSyncSession.md) assigns that texture a `bufferId` and can attach
several `PixelArtCanvas` instances to the same transport connection (e.g. one
per open tileset).

**Flow:**
1. A local mutation (a paint stroke, fill, resize, or setting `texture`) fires
   `PixelArtCanvas.onBufferUpdated` (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)).
2. `PixelSyncSession` stamps the event with `bufferId` / `clientId` / `seq` /
   `timestamp` and calls `transport.sendCommand(cmd)`.
3. The transport delivers the command to [`PixelSyncServer.receive()`](./PixelSyncServer.md).
4. The server resolves conflicts (see [ConflictResolver](./ConflictResolver.md)), applies the command to its authoritative
   [`PixelWorld`](./PixelWorld.md), and broadcasts it to clients subscribed to that buffer.
5. Each subscribed client's transport calls `onCommand(cmd)`, which
   `PixelSyncSession` routes to the matching `PixelArtCanvas.applyRemoteCommand()`.
6. `applyRemoteCommand` suppresses `onBufferUpdated` while applying, so the
   result is never re-broadcast: no echo loop.

Buffers are not sent in bulk. A client receives a buffer's pixel data only
when it subscribes to that specific `bufferId` (via `attach`/`createBuffer`).

## Pieces

| Module | Description |
|---|---|
| [types](./types.md) | `PixelNetworkCommand` wire format and its constituent event types |
| [PixelTransport](./PixelTransport.md) | Transport-agnostic interface consumers implement (WebSocket, WebRTC, ...) |
| [PixelSyncSession](./PixelSyncSession.md) | Client-side, multi-buffer orchestrator |
| [PixelSyncServer](./PixelSyncServer.md) | Headless, server-authoritative sync manager |
| [PixelWorld](./PixelWorld.md) | Headless, multi-buffer pixel registry used by the server |
| [PixelCommandApplier](./PixelCommandApplier.md) | `applyCommandToWorld`, headless command replay |
| [ConflictResolver](./ConflictResolver.md) | Per-pixel conflict resolution strategy (`LastWriteWinsResolver` and custom resolvers) |
