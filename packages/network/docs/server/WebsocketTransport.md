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
It decodes the credential offered by
[`connectWebSocket`](../client/connectWebSocket.md) into `request.credential`.

Messages sent to one socket during an event loop turn leave in a single write
once the turn ends, so a broadcast costs one write per recipient rather than
one per message.

## `[Symbol.dispose]()`

Terminates its sockets and stops handling upgrades. The HTTP server's `close`
event does the same, but Node.js only emits it once every connection has ended,
upgraded sockets included. Dispose the network server separately.

## Vite plugin

`createWebSocketNetworkPlugin` mounts a `WebsocketTransport` in dev and preview.
A supplied `server` owns access policy; otherwise the plugin constructs one from
`extensions`, `rights`, `defaultRole`, and `auth`.
