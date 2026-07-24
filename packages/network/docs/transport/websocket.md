# transport/websocket

`ws` transport adapter that forwards connect/disconnect/message events into [`NetworkServer`](../NetworkServer.md).

```ts
new WebsocketTransport(options: WebsocketTransportOptions)

interface WebsocketTransportOptions {
  /**
   * WebSocket upgrade path.
   * @default "/ws-sync"
   */
  path?: string;
  httpServer: Server | Http2SecureServer;
  server: NetworkServer;
  logger?: Logger; // pino
}
```

## Static Properties

### `DefaultPath`

```ts
static DefaultPath: string // "/ws-sync"
```

## Runtime Behavior

- Registers an `"upgrade"` listener on `httpServer`.
- Accepts upgrades only when request pathname equals `path`.
- Uses `WebSocketServer({ noServer: true })` so it can share Vite's HTTP server safely.

Per accepted socket:

- Creates `clientId` via `randomUUID()`.
- Calls `server.handleConnect(client)` with JSON-encoding send wrapper.
- Parses incoming frames (`JSON.parse`) and forwards to `server.handleMessage(clientId, raw)`.
- Calls `server.handleDisconnect(clientId)` on close.
- Logs socket errors via `logger`.

On `httpServer` close:

- Removes upgrade listener.
- Terminates all connected websocket clients.
- Closes websocket server instance.

This cleanup prevents stale upgraded connections from blocking a subsequent listen on the same port during Vite restarts.

## Example

```ts
import {
  NetworkServer
} from "@jolly-pixel/network";
import {
  WebsocketTransport
} from "@jolly-pixel/network/transport/websocket.ts";

const server = new NetworkServer();
new WebsocketTransport({
  httpServer,
  server
});
```
