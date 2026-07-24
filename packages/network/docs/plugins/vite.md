# plugins/vite

Vite dev-server integration for [`NetworkServer`](../NetworkServer.md) + [`WebsocketTransport`](../transport/websocket.md).

```ts
function createWebSocketNetworkPlugin(
  options: WebsocketVitePluginOptions
): Plugin // vite.Plugin

interface WebsocketVitePluginOptions {
  plugins?: NetworkPlugin[];
  /**
   * Dedicated websocket path to avoid conflicting with Vite HMR.
   * @default "/ws-sync"
   */
  path?: string;
}
```

## Behavior

- Creates one `NetworkServer`.
- Registers every plugin from `options.plugins`.
- Returns a Vite plugin (`name: "network-websocket"`).
- In `configureServer`, creates `WebsocketTransport` only when `viteServer.httpServer` exists.
- No-op in server modes without `httpServer`.

## Example

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      path: "/ws-sync"
    })
  ]
});
```
