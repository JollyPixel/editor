# Network Sync

Multiplayer sync for one `PixelArtCanvas` per session, with server-authoritative state.

## Read This First

1. One `PixelSyncServer` owns one `PixelBuffer`.
2. One `PixelSyncClient` owns one `PixelArtCanvas`.
3. One room maps to one shared buffer.

If you sync 3 canvases, run 3 rooms.

## 60-Second Setup

### Server

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelBuffer,
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";

export default defineConfig({
   plugins: [
      createWebSocketNetworkPlugin({
         roomAuthorities: [
            new PixelSyncServer({
               id: "pixel-draw:main",
               buffer: new PixelBuffer({
                size: { x: 80, y: 80 }
              })
            })
         ]
      })
   ]
});
```

### Client

```ts
import * as network from "@jolly-pixel/network";
import {
   PixelSyncClient,
   type PixelNetworkCommand,
   type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const networkClient = new network.Client({
  url: `${wsProtocol}//${location.host}/ws-sync`
});
const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
   "pixel-draw:main"
);

const syncClient = new PixelSyncClient({ room });
syncClient.attach(canvas);
```

## How It Behaves

1. Local edits on the canvas emit buffer events.
2. `PixelSyncClient` stamps `clientId`, `seq`, and `timestamp` and sends.
3. `PixelSyncServer` validates, resolves conflicts, applies, then broadcasts.
4. Clients apply remote commands without re-broadcasting, so no echo loop.

On connect, the server immediately sends a snapshot so late joiners catch up.

## Cursor Tracking

Multiplayer cursors ride the same room, no server authority needed — presence is relayed by `network.Room` itself. See [PixelCursorSync](./PixelCursorSync.md).

## What To Read Next

| File | Use it when |
|---|---|
| [PixelSyncClient](./PixelSyncClient.md) | You are wiring client lifecycle (`attach`/`detach`/`destroy`) |
| [PixelSyncServer](./PixelSyncServer.md) | You are wiring server rooms and authoritative buffers |
| [PixelCursorSync](./PixelCursorSync.md) | You want to show peers' live cursors on the canvas |
