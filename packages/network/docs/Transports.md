# Transports

## Vite plugin

Use the Vite plugin for editor development servers. It creates the `Server`, wires the websocket transport and registers your extensions. It serves both `vite` and `vite preview`.

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
  /**
   * Forwarded to the WebSocket transport. See below.
   * @default []
   */
  allowedOrigins?: readonly string[] | true;
}
```

The plugin hands the transport Vite's own `server.allowedHosts` (`preview.allowedHosts` under `vite preview`), so the socket accepts the hosts the dev server does.

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
by path, checks its Host and Origin headers, calls
`server.authenticate({ clientId, url, headers, remoteAddress })`, and only then
calls `handleConnect`. A refused connection is closed with code `4401` and
never reaches the server's session table. A connection the server revokes is
closed with code `4001`.

### Hosts and origins

A browser lets any page open a WebSocket to `localhost`, and sends the page's
origin along. The transport answers `403` before authenticating when:

- the Host header names a host it does not serve. IP addresses, `localhost` and
  `*.localhost` are always served; add domain names to `allowedHosts`. This
  blocks DNS rebinding.
- the Origin header is neither the request's own host nor listed in
  `allowedOrigins`. Upgrades without an Origin header come from non-browser
  clients and pass.

```ts
new WebsocketTransport({
  httpServer,
  server,
  path: "/ws-sync",
  allowedHosts: ["studio.example.com", ".jolly.example.com"],
  allowedOrigins: ["https://editor.example.com"]
});
```

An `allowedHosts` entry starting with `.` also accepts its subdomains. `true`
accepts any host or origin. Behind a reverse proxy that rewrites the Host
header, list the public origin in `allowedOrigins`.

### Limits

```ts
interface WebsocketTransportOptions {
  /**
   * @default 16 MiB
   */
  maxPayload?: number;
  /**
   * @default 32 MiB
   */
  maxBufferedBytes?: number;
  /**
   * @default 30_000
   */
  heartbeatMs?: number;
}
```

- `maxPayload` is the largest message a client may send, in bytes. A larger one
  closes the socket with code `1009`.
- `maxBufferedBytes` is how much a socket may have queued for sending. A client
  that stops reading passes it and is terminated.
- `heartbeatMs` is the interval between pings. A socket that has not answered
  the previous ping is terminated. `0` disables pings.

The transport stops reading a socket while 64 of its messages are in flight,
and resumes once 16 remain.

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

`connect()` opens one connection and returns the `ClientSocket` a `Client` expects. It authenticates with `url: "loopback:"` and no header, then calls `handleConnect`. A refused connection closes with code `4401` and a revoked one with `4001`, as they do over a WebSocket.

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
| `host.close()` | closes every relayed socket, closes its client socket with code `1001`, and stops listening; the port stays open |
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
