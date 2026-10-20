# In-process transports

Connect a client to a server in the same process, a worker, or across a
WebRTC data channel. Both ends import from `@jolly-pixel/network`; the client
side of channels is also exported by `@jolly-pixel/network/client`.

```ts
import { Client } from "@jolly-pixel/network/client";
import { LoopbackTransport, Server } from "@jolly-pixel/network";

const server = new Server();
const transport = new LoopbackTransport({ server });
const client = new Client({ socket: () => transport.connect() });
```

## LoopbackTransport

`LoopbackTransport({ server }).connect({ credential? })` opens a same-process
client socket. JSON messages arrive asynchronously; normal authentication
applies, with `credential` set on the authentication attempt.

## Channels

`ChannelTransport({ port, host }).connect()` reaches a `ChannelTransportHost`
over BroadcastChannel, MessagePort, or Worker. Share `host.id` before connecting.

Optional `socketPort` isolates socket traffic. Close host and transport separately;
shared ports remain caller-owned. Transport messages carry
`tag: CHANNEL_TRANSPORT_TAG`, so other traffic can share the port.

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
