# WebsocketTransport

Accept WebSocket connections on a Node.js HTTP server. Import from
`@jolly-pixel/network/node`.

```ts
import http from "node:http";
import { Server } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

const httpServer = http.createServer();
const server = new Server();
const transport = new WebsocketTransport({
  httpServer,
  server,
  path: "/ws-sync"
});
httpServer.listen(3000);
```

## Constructor

`new WebsocketTransport({ httpServer, server, path, ...options })`.
Options control hosts, origins, payload limits, heartbeat, and compression.
Compression applies to text frames above its `threshold`. A binary frame is
compressed only when its sender passes `{ compress: true }`
([`SendOptions`](./Server.md)),
since media such as PNG or Opus barely shrinks. It decodes the credential offered by
[`connectWebSocket`](../client/connectWebSocket.md) into `request.credential`.

Without `httpServer` and `path`, the transport listens to nothing and takes
the upgrades another listener hands to `handleUpgrade`.

Messages sent to one socket during an event loop turn leave in a single write
once the turn ends, so a broadcast costs one write per recipient rather than
one per message.

## `handleUpgrade(request, socket, head)`

Runs the handshake checks, authenticates, and connects the socket, for an
upgrade whose path the caller already matched. A server hosting several
networks reads the path in its own `upgrade` listener and hands each upgrade to
the transport of the matching network.

```ts
const transport = new WebsocketTransport({ server });
httpServer.on("upgrade", (request, socket, head) => {
  if (request.url === "/projects/a/ws-sync") {
    transport.handleUpgrade(request, socket, head);
  }
});
```

## HandshakePolicy

The host and origin rules of the handshake, exported so an HTTP server in front
of the transport can apply the same `allowedHosts` to its own requests.

```ts
import { HandshakePolicy } from "@jolly-pixel/network/node";

const policy = new HandshakePolicy({ allowedHosts: ["studio.example"] });
policy.admitsHost("studio.example:3000"); // true
policy.admitsHost("attacker.example"); // false
policy.checkHandshake(request.headers); // null, "host" or "origin"
```

`admitsHost(host)` takes a `Host` header value. It admits `localhost`, its
`.localhost` subdomains, IP addresses, and each `allowedHosts` entry; an entry
starting with `.` also admits its subdomains. `allowedHosts: true` admits every
host. `checkHandshake(headers)` also refuses an `Origin` whose host differs from
`Host`, unless `allowedOrigins` lists it.

## `[Symbol.dispose]()`

Terminates its sockets and stops handling upgrades. The HTTP server's `close`
event does the same, but Node.js only emits it once every connection has ended,
upgraded sockets included. Dispose the network server separately.

## Vite plugin

`createWebSocketNetworkPlugin` mounts a `WebsocketTransport` in dev and preview.
A supplied `server` owns access policy; otherwise the plugin constructs one from
`extensions`, `rights`, `defaultRole`, and `auth`.
