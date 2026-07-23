# Network Sync

Multiplayer sync for one `PixelArtCanvas` per session, with server-authoritative state.

## Read This First

1. One `PixelSyncServer` owns one `PixelBuffer`.
2. One `PixelSyncSession` owns one `PixelArtCanvas`.
3. One namespace maps to one shared buffer.

If you sync 3 canvases, run 3 namespaces.

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
         plugins: [
            new PixelSyncServer({
               namespace: "pixel-draw:main",
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
import { NetworkClient } from "@jolly-pixel/network";
import {
   PixelSyncSession,
   type PixelNetworkCommand,
   type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new NetworkClient({
  url: `${wsProtocol}//${location.host}/ws-sync`
});
const transport = client.channel<PixelNetworkCommand, PixelServerMessage>(
   "pixel-draw:main"
);

const session = new PixelSyncSession({ transport });
session.attach(canvas);
```

## How It Behaves

1. Local edits on the canvas emit buffer events.
2. `PixelSyncSession` stamps `clientId`, `seq`, and `timestamp` and sends.
3. `PixelSyncServer` validates, resolves conflicts, applies, then broadcasts.
4. Clients apply remote commands without re-broadcasting, so no echo loop.

On connect, the server immediately sends a snapshot so late joiners catch up.

## What To Read Next

| File | Use it when |
|---|---|
| [PixelSyncSession](./PixelSyncSession.md) | You are wiring client lifecycle (`attach`/`detach`/`destroy`) |
| [PixelSyncServer](./PixelSyncServer.md) | You are wiring server namespaces and authoritative buffers |
