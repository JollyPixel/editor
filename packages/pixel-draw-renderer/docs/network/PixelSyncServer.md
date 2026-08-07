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
      extensions: [mainTexture]
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
  uvRegions: UVRegionData[];
}

type PixelServerMessage = network.NetworkServerMessage<PixelNetworkCommand, PixelBufferSnapshot>;
```

## Conflict Policy (Minimal)

By default, `PixelSyncServer` uses `@jolly-pixel/network`'s [`LastWriteWinsResolver`](../../../network/docs/sync/Conflicts.md), keyed per pixel/region (not by full command), so pass `network.ConflictResolver` when supplying a custom one.

What that means:
1. `stroke` and `select-edit` conflicts resolve per pixel.
2. `uv-region-moved` conflicts resolve per **region face** (`<id>:<face>`, or `<id>:*` for a collapsed region), so two peers laying out different faces of the same region never reject each other.
3. `uv-region-deleted` and `uv-region-state-changed` rewrite the whole region, so they resolve against *every* face key at once and are all-or-nothing: rejected by any one key, the command is not applied at all.
4. `resized`, `texture-replaced`, `global-fill`, and `uv-region-created` are always accepted.
5. For the same key, same-client commands are accepted in send order; otherwise newer `timestamp` wins (and `clientId` breaks ties).

You can override this with `conflictResolver` in `PixelSyncServerOptions` when you need custom behavior.

## API You Might Actually Use

- `server.id`: room key.
- `server.name`: always `"pixel-draw.renderer"`, shared by every instance — the namespace a `network.Server`'s `rights` table would key its rules against (e.g. `"pixel-draw.renderer.*"`). Required by `network.Extension`, but `PixelSyncServer` doesn't implement `getEventName()` yet — configuring `rights` for this namespace on the server will throw on the first message until it does (see [Rights](../../../network/docs/Rights.md)).
- `server.buffer`: authoritative buffer.
- `server.receive(cmd, context)`: useful in tests and replay tools.
- `server.snapshot()`: exports current `PixelBufferSnapshot`.

`onClientConnect`, `onClientDisconnect`, and `onMessage` are `network.Extension` lifecycle hooks invoked by `@jolly-pixel/network`. Each is handed a `context: network.RoomContext`, whose `context.room.broadcast()` is what `receive()` calls — `PixelSyncServer` never stores a broadcast function, it only ever uses the one it's handed for the event it's currently reacting to. For a push with no triggering client event, use `network.Server.broadcast(roomId, payload)`.

## Multi-Buffer Example

```ts
createWebSocketNetworkPlugin({
  extensions: [
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
