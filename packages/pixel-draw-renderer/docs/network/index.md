# Network synchronization

The network API synchronizes one `PixelArtCanvas` through one `@jolly-pixel/network` room. `PixelSyncServer` owns the authoritative `PixelBuffer`; each browser uses a `PixelSyncClient` to apply snapshots and exchange committed edits.

Cursor and in-progress edit previews are optional. They use the room's presence channel and never change the authoritative buffer.

## Guides

- [Set up synchronization](./guides/setup.md) covers the server, browser client, startup order, readiness and teardown.
- [Add presence previews](./guides/presence.md) adds cursors, stroke ghosts, UV drags and selection previews to the same room.

Start with the setup guide. The API reference is useful when wrapping these classes in application lifecycle code or building a custom transport adapter.

## API reference

| Page | API |
|---|---|
| [`PixelSyncClient`](./api/PixelSyncClient.md) | Client attachment, readiness and snapshot events |
| [`PixelSyncServer`](./api/PixelSyncServer.md) | Authoritative state, validation and conflict resolution |
| [Presence sync](./api/PresenceSync.md) | `PixelCursorSync`, `PixelStrokeGhostSync`, `UVGhostSync` and `SelectionGhostSync` |
| [Canvas integration](./api/CanvasIntegration.md) | Hooks and remote-application methods used by custom adapters |

## Supported imports

Browser code can import the client classes and wire types from the package root:

```ts
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  PixelSyncClient,
  SelectionGhostSync,
  UVGhostSync,
  type PixelBufferSnapshot,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
```

Server code uses the server-only entry point:

```ts
import {
  PixelSyncServer,
  applyCommandToBuffer,
  type PixelSyncServerOptions
} from "@jolly-pixel/pixel-draw.renderer/network/server.ts";
```

`PixelSyncServer` is excluded from the package root because it imports the Node.js side of `@jolly-pixel/network`.
