// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import { NetworkServer } from "../NetworkServer.ts";
import { NetworkPlugin } from "../NetworkPlugin.ts";
import { WebsocketTransport } from "../transport/websocket.ts";

export interface WebsocketVitePluginOptions {
  plugins?: NetworkPlugin[];
  /**
   * WebSocket upgrade path, kept distinct from Vite's own HMR socket so both
   * can share the dev server's HTTP port.
   *
   * @default "/ws-sync"
   */
  path?: string;
}

export function createWebSocketNetworkPlugin(
  options: WebsocketVitePluginOptions
): Plugin {
  const { path, plugins = [] } = options;

  const server = new NetworkServer();
  for (const plugin of plugins) {
    server.register(plugin);
  }

  return {
    name: "network-websocket",
    configureServer(viteServer) {
      const httpServer = viteServer.httpServer;
      if (!httpServer) {
        return;
      }

      new WebsocketTransport({ path, httpServer, server });
    }
  };
}
