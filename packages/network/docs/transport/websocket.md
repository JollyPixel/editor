# transport/websocket

Pure `ws`-server plumbing: forwards raw connect/disconnect/message events into a [`NetworkServer`](../NetworkServer.md). Carries no knowledge of namespaces or plugins.

## Types

```ts
new WebsocketTransport(options: WebsocketTransportOptions)

interface WebsocketTransportOptions {
  /**
   * WebSocket upgrade path, kept distinct from Vite's own HMR socket so both
   * can share the dev server's HTTP port.
   * @default "/ws-sync"
   */
  path?: string;

  httpServer: Server | Http2SecureServer;
  server: NetworkServer;
  logger?: Logger; // pino
}
```

## Properties

### `DefaultPath`

```ts
static DefaultPath: string // "/ws-sync"
```

## Behavior

Attaches to `httpServer`'s `"upgrade"` event and filters by `path` (using `noServer: true` rather than passing `server`/`path` straight to `WebSocketServer`, so the socket can share Vite's HTTP server safely). Each accepted connection is assigned a `randomUUID()` client id and wrapped into a `ClientHandle` passed to `server.handleConnect()`; incoming frames are JSON-parsed and forwarded to `server.handleMessage()`; socket close forwards to `server.handleDisconnect()`.

On the underlying `httpServer`'s `"close"` event, this transport force-terminates any still-open clients and closes its `WebSocketServer` — needed because Vite restarts its HTTP server in place on config changes, and a lingering upgraded socket would otherwise keep the old server's port bound, causing the next `.listen()` to fail with `EADDRINUSE`.

## Example

```ts
import { NetworkServer } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/transport/websocket.ts";

const server = new NetworkServer();
new WebsocketTransport({ httpServer, server });
```
