// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import { Server } from "../server/Server.ts";
import { WebsocketTransport } from "../transport/websocket.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../transport/constants.ts";
import type { Extension } from "../server/Extension.ts";
import type { RightsMap } from "../server/RightsTable.ts";

export interface WebsocketVitePluginOptions {
  extensions?: Extension[];
  rights?: RightsMap;
  /**
   * WebSocket upgrade path, kept separate from Vite HMR.
   * @default DEFAULT_WEBSOCKET_PATH
   */
  path?: string;
}

export function createWebSocketNetworkPlugin(
  options: WebsocketVitePluginOptions
): Plugin {
  const {
    path = DEFAULT_WEBSOCKET_PATH,
    extensions = [],
    rights
  } = options;

  const server = new Server({ rights });
  for (const extension of extensions) {
    server.register(extension);
  }

  return {
    name: "network-websocket",
    configureServer({ httpServer }) {
      if (!httpServer) {
        return;
      }

      new WebsocketTransport({
        path,
        httpServer,
        server
      });
    }
  };
}
