# Transports

Connect sockets to server sessions and supply client socket factories.

```ts
import { Client } from "@jolly-pixel/network/client";
import { LoopbackTransport, Server } from "@jolly-pixel/network";

const server = new Server();
const transport = new LoopbackTransport({ server });
const client = new Client({ socket: () => transport.connect() });
```

## connectWebSocket

`connectWebSocket({ url?, credential? })` opens a client socket.
Default URL uses the page host and `/ws-sync`; supply it explicitly in Node.

## WebsocketTransport

`WebsocketTransport`
from `/node` takes `{ httpServer, server, path, ...options }`.
Options control hosts, origins, payload limits, heartbeat, and compression.

Closing the HTTP server releases sockets. Dispose the network server separately.

## Vite plugin

`createWebSocketNetworkPlugin` from `/node` mounts in dev and preview.
A supplied `server` owns access policy; otherwise the plugin constructs one.

## LoopbackTransport

`LoopbackTransport({ server }).connect()` opens a same-process client socket.
JSON messages arrive asynchronously; normal authentication applies.

## Channels

`ChannelTransport({ port, host }).connect()` reaches a `ChannelTransportHost`
over BroadcastChannel, MessagePort, or Worker. Share `host.id` before connecting.

Optional `socketPort` isolates socket traffic. Close host and transport separately;
shared ports remain caller-owned.
