# transport/websocket

`ws` transport adapter that forwards connection events into [`Server`](../Server.md).

```ts
new WebsocketTransport(options: WebsocketTransportOptions)

interface WebsocketTransportOptions {
  /**
   * WebSocket upgrade path.
   */
  path: string;
  httpServer: Server | Http2SecureServer; // node:http Server
  server: Server; // @jolly-pixel/network Server
}
```

## Quick Use

- Create a `Server` instance.
- Create one `WebsocketTransport` with `httpServer`, `server`, and `path`.
- Let the transport forward events into server handlers.

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
