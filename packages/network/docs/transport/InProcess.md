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
client socket. Messages arrive asynchronously, and each binary frame is copied
on delivery as a socket would. Normal authentication applies, with
`credential` set on the authentication attempt.

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
`RTCDataChannel` into a port for either side, and sets its `binaryType` to
`"arraybuffer"`. Each message is encoded as a
[frame](../protocol/Messages.md#frames), UTF-8 encoded when it is text, and
sent in binary chunks: one flag byte (bit 0: last chunk, bit 1: text), then at
most `chunkLength` bytes of the message (default 16,384). The port queues
chunks while `bufferedAmount` is above `highWaterMark` bytes (default 1 MiB)
and delivers messages once `start()` is called. A malformed chunk or frame, or
a message longer than `maxMessageLength` bytes (default 16 MiB), closes the
channel. `closed` reports whether either side closed it.
