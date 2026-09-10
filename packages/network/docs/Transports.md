# Transports

## Vite plugin

Use the Vite plugin for editor development servers. It creates the `Server`, wires the websocket transport and registers your extensions.

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import { VoxelSyncServer, VoxelWorld } from "@jolly-pixel/voxel.renderer";

const world = new VoxelWorld(16);
world.addLayer("Ground");

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new VoxelSyncServer({ id: "voxel-map:world", world })
      ]
    })
  ]
});
```

```ts
interface WebsocketVitePluginOptions {
  extensions?: Extension[];
  /**
   * Forwarded to the underlying Server, shared by every extension.
   */
  rights?: RightsMap;
  /**
   * Forwarded to the underlying Server. See ./Authentication.md.
   */
  defaultRole?: string;
  auth?: AuthenticationProvider;
  /**
   * Dedicated path, kept off Vite HMR.
   * @default "/ws-sync"
   */
  path?: string;
}
```

## WebsocketTransport

Use `WebsocketTransport` with an existing HTTP server. It forwards connection events to the server's handlers.

```ts
import * as network from "@jolly-pixel/network";
import {
  WebsocketTransport
} from "@jolly-pixel/network/transport/websocket.ts";

const server = new network.Server();

new WebsocketTransport({
  httpServer,
  server,
  path: "/ws-sync"
});
```

The transport authenticates before it opens a session: it filters the upgrade
by path, calls `server.authenticate({ clientId, url, headers })`, and only then
calls `handleConnect`. A refused connection is closed with code `4401` and
never reaches the server's session table.

It also negotiates the subprotocol, selecting the bare `jolly-pixel` value so a
credential offered as `jolly-pixel.auth.<base64url>` is never echoed back. See
[Authentication](./Authentication.md#the-handshake).
