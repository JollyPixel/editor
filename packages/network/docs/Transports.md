# Transports

## Vite plugin

Use the Vite plugin for editor development servers. It creates the `Server`, wires the websocket transport and registers your extensions.

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import { PresenceOnlyExtension } from "@jolly-pixel/network";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new PresenceOnlyExtension("lobby")
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

## LoopbackTransport

Use `LoopbackTransport` when the server lives in the same process as its clients, a browser page included. No socket is opened.

```ts
import * as network from "@jolly-pixel/network";
import {
  LoopbackTransport
} from "@jolly-pixel/network/transport/loopback.ts";

const server = new network.Server();
const transport = new LoopbackTransport({ server });

const client = new network.Client({
  socket: () => transport.connect()
});
```

`connect()` opens one connection and returns the `ClientSocket` a `Client` expects. It authenticates with `url: "loopback:"` and no header, then calls `handleConnect`. A refused connection closes with code `4401`, as it does over a WebSocket.

Envelopes are serialized to JSON and delivered on a later microtask, so a message never arrives inside the call that sent it.

The root entry and this transport are browser-compatible. Node.js adapters
(`WorkerExtensionProxy` and `PasswordAuthentication`) are exported separately
from `@jolly-pixel/network/node`.
