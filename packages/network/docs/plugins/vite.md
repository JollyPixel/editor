# plugins/vite

Vite dev-server wiring for [`NetworkServer`](../NetworkServer.md) + [`WebsocketTransport`](../transport/websocket.md).

## Types

```ts
function createWebSocketNetworkPlugin(
  options: WebsocketVitePluginOptions
): Plugin // vite.Plugin

interface WebsocketVitePluginOptions {
  plugins?: NetworkPlugin[];
  /**
   * WebSocket upgrade path, kept distinct from Vite's own HMR socket so both
   * can share the dev server's HTTP port.
   * @default "/ws-sync"
   */
  path?: string;
}
```

## Behavior

Creates a `NetworkServer`, registers every plugin in `options.plugins`, and returns a Vite `Plugin` whose `configureServer` hook creates a `WebsocketTransport` bound to the dev server's `httpServer` once it exists (no-ops if Vite has no `httpServer`, e.g. middleware mode).

## Example

```ts
import { NetworkPlugin, type ClientHandle } from "@jolly-pixel/network";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";

class EchoPlugin extends NetworkPlugin {
  readonly namespace = "echo";

  onClientConnect(client: ClientHandle) {}
  onClientDisconnect(clientId: string) {}
  onMessage(clientId: string, payload: unknown) {}
}

export default {
  plugins: [
    createWebSocketNetworkPlugin({
      plugins: [new EchoPlugin()]
    })
  ]
};
```
