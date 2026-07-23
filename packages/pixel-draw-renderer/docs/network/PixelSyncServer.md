# PixelSyncServer

Authoritative server for pixel sync.

One instance manages one shared `PixelBuffer` under one namespace.

```ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelBuffer,
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";

const mainTexture = new PixelSyncServer({
  namespace: "pixel-draw:main",
  buffer: new PixelBuffer({
    size: { x: 80, y: 80 }
  })
});

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      plugins: [mainTexture]
    })
  ]
});
```

## Important Rules

1. Do not reuse a namespace across different buffers.
2. Pre-size the server buffer to match expected client startup state.
3. Register one `PixelSyncServer` per collaborative canvas.

## What It Handles

1. Sends a snapshot immediately when a client joins.
2. Accepts incoming commands.
3. Resolves conflicts.
4. Applies accepted commands to authoritative buffer.
5. Broadcasts accepted commands to clients in the same namespace.

## Constructor Options

```ts
new PixelSyncServer(options?: PixelSyncServerOptions)

interface PixelSyncServerOptions {
  namespace?: string; // default: "pixel-draw"
  buffer?: PixelBuffer; // default: blank 1x1
  conflictResolver?: PixelConflictResolver; // default: LastWriteWinsResolver
}

interface PixelBufferSnapshot {
  size: Vec2;
  pixels: string; // base64 RGBA
  uvRegions: UVRegion[];
}

type PixelServerMessage =
  | { type: "snapshot"; data: PixelBufferSnapshot; }
  | { type: "command"; data: PixelNetworkCommand; };
```

## Conflict Policy (Minimal)

By default, `PixelSyncServer` uses `LastWriteWinsResolver`.

What that means:
1. `stroke` and `select-edit` conflicts resolve per pixel.
2. `uv-region-moved` and `uv-region-deleted` conflicts resolve per region id.
3. `resized`, `texture-replaced`, `global-fill`, and `uv-region-created` are always accepted.
4. For the same key, same-client commands are accepted in send order; otherwise newer `timestamp` wins (and `clientId` breaks ties).

You can override this with `conflictResolver` in `PixelSyncServerOptions` when you need custom behavior.

## API You Might Actually Use

- `server.namespace`: namespace key.
- `server.buffer`: authoritative buffer.
- `server.receive(cmd)`: useful in tests and replay tools.
- `server.snapshot()`: exports current `PixelBufferSnapshot`.

`attach`, `onClientConnect`, `onClientDisconnect`, and `onMessage` are `NetworkPlugin` lifecycle hooks invoked by `@jolly-pixel/network`.

## Multi-Buffer Example

```ts
createWebSocketNetworkPlugin({
  plugins: [
    new PixelSyncServer({
      namespace: "pixel-draw:characters",
      buffer: new PixelBuffer({ size: { x: 32, y: 32 } })
    }),
    new PixelSyncServer({
      namespace: "pixel-draw:tiles",
      buffer: new PixelBuffer({ size: { x: 128, y: 128 } })
    })
  ]
});
```
