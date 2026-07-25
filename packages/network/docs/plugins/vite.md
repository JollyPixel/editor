# plugins/vite

Vite dev-server integration for [`Server`](../Server.md) + [`WebsocketTransport`](../transport/websocket.md).

```ts
function createWebSocketNetworkPlugin(
  options: WebsocketVitePluginOptions
): Plugin // vite.Plugin

interface WebsocketVitePluginOptions {
  roomAuthorities?: RoomAuthority[];
  /**
   * Dedicated websocket path to avoid conflicting with Vite HMR.
   * @default DEFAULT_WEBSOCKET_PATH ("/ws-sync")
   */
  path?: string;
}
```

## Example

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import {
  PixelSyncServer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  VoxelSyncServer,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

const world = new VoxelWorld(16);
world.addLayer("Ground");

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    allowedHosts: true
  },
  plugins: [
    createWebSocketNetworkPlugin({
      roomAuthorities: [
        new PixelSyncServer({
          id: "voxel-map:texture"
        }),
        new VoxelSyncServer({
          id: "voxel-map:world",
          world
        })
      ]
    })
  ]
});
```
