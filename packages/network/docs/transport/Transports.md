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

Messages sent to one socket during an event loop turn leave in a single write
once the turn ends, so a broadcast costs one write per recipient rather than
one per message.

`[Symbol.dispose]()` terminates its sockets and stops handling upgrades. The
HTTP server's `close` event does the same, but Node.js only emits it once every
connection has ended, upgraded sockets included. Dispose the network server
separately.

## Vite plugin

`createWebSocketNetworkPlugin` from `/node` mounts in dev and preview.
A supplied `server` owns access policy; otherwise the plugin constructs one.

## LoopbackTransport

`LoopbackTransport({ server }).connect({ credential? })` opens a same-process
client socket. JSON messages arrive asynchronously; normal authentication
applies, with `credential` set on the authentication attempt.

## Channels

`ChannelTransport({ port, host }).connect()` reaches a `ChannelTransportHost`
over BroadcastChannel, MessagePort, or Worker. Share `host.id` before connecting.

Optional `socketPort` isolates socket traffic. Close host and transport separately;
shared ports remain caller-owned.

A `credential` given to `ChannelTransport` travels with each connection. The
host passes it to `open({ credential })`, typed `SocketConnectOptions` like the
argument of `LoopbackTransport.connect`, so `open: (options) =>
loopback.connect(options)` hands it to the server.

### DataChannelPort

`new DataChannelPort(channel, options?)` turns an ordered, reliable
`RTCDataChannel` into a port for either side. It sends JSON split into frames of
at most `frameLength` UTF-16 code units (default 8,192), queues frames while
`bufferedAmount` is above `highWaterMark` bytes (default 1 MiB), and delivers
messages once `start()` is called. A malformed frame or a message longer than
`maxMessageLength` code units (default 16 MiB) closes the channel. `closed`
reports whether either side closed it.
