# Transports

## Vite plugin

Use the Vite plugin for editor development servers. It creates the `Server`, wires the websocket transport and registers your extensions.

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/node";
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
  /**
   * Forwarded to the WebSocket transport. See below.
   * @default false
   */
  compression?: boolean | WebsocketCompressionOptions;
}
```

## WebsocketTransport

Use `WebsocketTransport` with an existing HTTP server. It forwards connection events to the server's handlers.

```ts
import * as network from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

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

### Compression

`compression` negotiates `permessage-deflate` with clients that offer it. Browsers and the Node.js `WebSocket` always offer it, so the client side needs nothing. It is off by default.

```ts
new WebsocketTransport({
  httpServer,
  server,
  path: "/ws-sync",
  compression: true
});

interface WebsocketCompressionOptions {
  /**
   * zlib level, from 1 (fastest) to 9 (smallest).
   * @default 3
   */
  level?: number;
  /**
   * Messages shorter than this many bytes are sent uncompressed.
   * @default 64
   */
  threshold?: number;
}
```

Each socket keeps its compression context between messages, so repeated small messages such as presence updates also shrink. The cost is roughly 300 KB of zlib memory per connection. Enable compression when clients connect over a real network. On localhost it only costs CPU.

## LoopbackTransport

Use `LoopbackTransport` when the server lives in the same process as its clients, a browser page included. No socket is opened.

```ts
import * as network from "@jolly-pixel/network";

const server = new network.Server();
const transport = new network.LoopbackTransport({ server });

const client = new network.Client({
  socket: () => transport.connect()
});
```

`connect()` opens one connection and returns the `ClientSocket` a `Client` expects. It authenticates with `url: "loopback:"` and no header, then calls `handleConnect`. A refused connection closes with code `4401`, as it does over a WebSocket.

Envelopes are serialized to JSON and delivered on a later microtask, so a message never arrives inside the call that sent it.

The root entry, which exports this transport, is browser-compatible. Node.js
adapters (`WebsocketTransport`, `WorkerExtensionProxy` and
`PasswordAuthentication`) are exported separately from
`@jolly-pixel/network/node`.

## ChannelTransport

Use `ChannelTransport` when the server lives in another browsing context: another tab over a `BroadcastChannel`, an iframe over a `MessagePort`, or a worker. `ChannelTransportHost` runs next to the server and relays each remote connection to a local socket, usually one opened by `LoopbackTransport`.

```ts
import {
  ChannelTransport,
  ChannelTransportHost,
  Client,
  LoopbackTransport
} from "@jolly-pixel/network";

// Next to the server
const loopback = new LoopbackTransport({ server });
const host = new ChannelTransportHost({
  port: new BroadcastChannel("workspace"),
  open: () => loopback.connect()
});

// In another tab, once it knows host.id
const transport = new ChannelTransport({
  port: new BroadcastChannel("workspace"),
  host: hostId
});
const client = new Client({
  socket: () => transport.connect()
});
```

| Member | Role |
|---|---|
| `ChannelTransportHost({ port, open, id?, socketPort? })` | answers the connections addressed to `id` (a random UUID by default) |
| `host.close()` | closes every relayed socket and stops listening; the port stays open |
| `ChannelTransport({ port, host, socketPort? })` | opens connections served by the host with that id |
| `transport.connect()` | returns the `ClientSocket` a `Client` expects; throws once the transport is closed |
| `transport.close(event?)` | closes every open socket with `event` (code `1001` by default) and stops listening |

`ChannelTransport` is also exported from `@jolly-pixel/network/client`, for tabs that only connect.

A port is anything with `postMessage` and `message` listeners: a `BroadcastChannel`, a `MessagePort` (started for you) or a `Worker`. Transport messages carry `CHANNEL_TRANSPORT_TAG`, so the port can carry other messages too, and `isChannelTransportMessage` tells them apart. It checks the whole message shape, so a tagged message with a missing or mistyped field is ignored.

The transport does not find its host. Share `host.id` over the same port, or any other way, before connecting. A socket opened before the host listens never opens.

### One port per socket

A `BroadcastChannel` delivers every message to every context listening on it, so with one shared channel each tab receives, and pays to deserialize, the traffic of every other tab's sockets. Pass `socketPort` to give each socket its own port: only the connect message then travels on `port`, and everything else goes over the port that `socketPort(socketId)` opens.

```ts
const socketPort = (socket: string) => new BroadcastChannel(`workspace:${socket}`);

const host = new ChannelTransportHost({
  port: new BroadcastChannel("workspace"),
  open: () => loopback.connect(),
  socketPort
});
const transport = new ChannelTransport({
  port: new BroadcastChannel("workspace"),
  host: hostId,
  socketPort
});
```

Both factories must open the same channel for a given socket id. The connect message says whether the client opened a port, and the host follows it: a client without `socketPort` is served on `port`, and a client with one is closed with code `1002` by a host without one. Each end closes its per-socket port, calling `close()` when the port has one, once the socket closes or its transport or host closes.
