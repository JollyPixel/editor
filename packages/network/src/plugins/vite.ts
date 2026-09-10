// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import { Server } from "../server/Server.ts";
import { WebsocketTransport } from "../transport/websocket.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../transport/constants.ts";
import type { Extension } from "../server/extension/Extension.ts";
import type { RightsMap } from "../server/rights/RightsTable.ts";
import type { AuthenticationProvider } from "../server/auth/AuthenticationProvider.ts";

export interface WebsocketVitePluginOptions {
  extensions?: Extension[];
  rights?: RightsMap;
  defaultRole?: string;
  auth?: AuthenticationProvider;
  /**
   * Server to mount, constructed internally when omitted.
   */
  server?: Server;
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
    rights,
    defaultRole,
    auth
  } = options;

  const server = options.server ?? new Server({
    rights,
    defaultRole,
    auth
  });
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
