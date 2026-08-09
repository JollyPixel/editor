# Set up network synchronization

One room represents one shared pixel buffer. The room name passed to `Client.room()` must match the `id` of its `PixelSyncServer`.

## Server

This example registers a room named `pixel-draw:main` on the default `/ws-sync` WebSocket path:

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer/network/server.ts";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
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

Register a separate `PixelSyncServer` and room name for each collaborative canvas. The initial buffer becomes the snapshot sent to the first client and every late joiner.

## Browser client

Create the room and sync controller before joining. Attach the canvas before `room.join()` so the first snapshot has a target:

```ts
import { Client } from "@jolly-pixel/network/client";
import {
  PixelSyncClient,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";

const networkClient = new Client({
  identity: { username: "alice" }
});
const room = networkClient.room<
  PixelNetworkCommand,
  PixelServerMessage
>("pixel-draw:main");

const sync = new PixelSyncClient({ room });
sync.on("ready", () => {
  console.log("Initial snapshot received");
});
sync.attach(canvas);

room.join();
```

`Client` uses `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws-sync` by default. Pass `url` when the server uses another origin or WebSocket path.

## Startup and snapshots

The server sends a snapshot as soon as the room admits the client. `PixelSyncClient` applies it only when a canvas is attached. Follow this order:

1. Create the room.
2. Construct `PixelSyncClient` and register any `"ready"` or `"snapshot"` listeners.
3. Attach the canvas.
4. Call `room.join()`.

Optional presence helpers can attach after `"ready"`, when `room.peers` contains the initial peer snapshot. See [presence previews](./presence.md).

`sync.ready` becomes `true` when the first snapshot message arrives. With the ordering above, that snapshot has also been applied to the canvas. The `"ready"` event fires once; `"snapshot"` fires for every snapshot.

Snapshots replace texture pixels and UV regions, then clear local history. Remote resize and texture-replacement commands also clear local history.

## Committed edits

Local canvas mutations flow through `canvas.onBufferUpdated`. `PixelSyncClient` adds `clientId`, `seq` and `timestamp`, then sends the command to the room. The server validates the command, replaces its claimed `clientId` with the connection ID, resolves conflicts, applies accepted data and broadcasts the accepted command.

Commands echoed to their sender are ignored. Remote commands use `canvas.applyRemoteCommand()`, which does not emit `onBufferUpdated`, so they are not sent again.

Undo and redo keep the original edit timestamp. The default conflict resolver always accepts same-client replay order; commands from different clients use timestamp and then `clientId` as a tie-breaker. Client clocks therefore affect conflict results.

## Rights

`PixelSyncServer` exposes each command action through `getEventName()`, so it can use an `@jolly-pixel/network` rights table:

```ts
createWebSocketNetworkPlugin({
  extensions: [pixelServer],
  rights: {
    viewer: {
      "pixel-draw.renderer.$join": "write",
      "pixel-draw.renderer.$presence": "write",
      "pixel-draw.renderer.*": "read"
    },
    editor: {
      "pixel-draw.renderer.*": "write"
    }
  }
});
```

The network package reads the role from `identity.role`. Client-supplied identity is metadata, not authentication. Resolve the authenticated role in your server integration before relying on these rules. See [`@jolly-pixel/network` rights](../../../../network/docs/Rights.md).

## Teardown

Destroy sync helpers before destroying the canvas. Room and socket lifetime remain under application control:

```ts
sync.destroy();
room.leave();
networkClient.destroy();
canvas.destroy();
```

`sync.destroy()` detaches the canvas and removes the controller's room listener. It does not leave the room or close the shared socket.
