# PixelSyncServer

Authoritative server for pixel sync.

One instance manages one shared `PixelBuffer` under one room.

```ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelBuffer,
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";

const mainTexture = new PixelSyncServer({
  id: "pixel-draw:main",
  buffer: new PixelBuffer({
    size: { x: 80, y: 80 }
  })
});

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      roomAuthorities: [mainTexture]
    })
  ]
});
```

## Important Rules

1. Do not reuse a room across different buffers.
2. Pre-size the server buffer to match expected client startup state.
3. Register one `PixelSyncServer` per collaborative canvas.

## What It Handles

1. Sends a snapshot immediately when a client joins.
2. Accepts incoming commands.
3. Resolves conflicts.
4. Applies accepted commands to authoritative buffer.
5. Broadcasts accepted commands to clients in the same room.

## Constructor Options

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  id?: string; // default: "pixel-draw"
  buffer?: PixelBuffer; // default: blank 1x1
  conflictResolver?: network.ConflictResolver; // default: network.LastWriteWinsResolver
}

interface PixelBufferSnapshot {
  size: Vec2;
  pixels: string; // base64 RGBA
  uvRegions: UVRegion[];
}

type PixelServerMessage = network.NetworkServerMessage<PixelNetworkCommand, PixelBufferSnapshot>;
```

## Conflict Policy (Minimal)

By default, `PixelSyncServer` uses `@jolly-pixel/network`'s [`LastWriteWinsResolver`](../../../network/docs/sync/ConflictResolver.md), keyed per pixel/region (not by full command), so pass `network.ConflictResolver` when supplying a custom one.

What that means:
1. `stroke` and `select-edit` conflicts resolve per pixel.
2. `uv-region-moved` and `uv-region-deleted` conflicts resolve per region id.
3. `resized`, `texture-replaced`, `global-fill`, and `uv-region-created` are always accepted.
4. For the same key, same-client commands are accepted in send order; otherwise newer `timestamp` wins (and `clientId` breaks ties).

You can override this with `conflictResolver` in `PixelSyncServerOptions` when you need custom behavior.

## API You Might Actually Use

- `server.id`: room key.
- `server.buffer`: authoritative buffer.
- `server.receive(cmd, room)`: useful in tests and replay tools.
- `server.snapshot()`: exports current `PixelBufferSnapshot`.

`onClientConnect`, `onClientDisconnect`, and `onMessage` are `network.RoomAuthority` lifecycle hooks invoked by `@jolly-pixel/network`. Each is handed a `room: network.RoomHandle` (whatever calls `onMessage` also has `broadcast()`, so it just passes itself) — `PixelSyncServer` never stores a broadcast function, it only ever uses the one it's handed for the event it's currently reacting to. For a push with no triggering client event, use `network.Server.broadcast(roomId, payload)`.

## Multi-Buffer Example

```ts
createWebSocketNetworkPlugin({
  roomAuthorities: [
    new PixelSyncServer({
      id: "pixel-draw:characters",
      buffer: new PixelBuffer({ size: { x: 32, y: 32 } })
    }),
    new PixelSyncServer({
      id: "pixel-draw:tiles",
      buffer: new PixelBuffer({ size: { x: 128, y: 128 } })
    })
  ]
});
```
