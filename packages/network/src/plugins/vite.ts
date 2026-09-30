// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import { Server } from "../server/Server.ts";
import {
  WebsocketTransport,
  type WebsocketCompressionOptions
} from "../transport/websocket.ts";
import { DEFAULT_WEBSOCKET_PATH } from "../transport/constants.ts";
import type { Extension } from "../server/extension/Extension.ts";
import type { RightsMap } from "../server/rights/RightsTable.ts";
import type { AuthenticationProvider } from "../server/auth/AuthenticationProvider.ts";

export interface WebsocketVitePluginOptions {
  /**
   * Extensions registered on the server, including a provided `server`.
   * @default []
   */
  extensions?: Extension[];
  /**
   * Role rights table, ignored when `server` is provided.
   * Every role gets "write" when omitted.
   */
  rights?: RightsMap;
  /**
   * Fallback role handed to `auth`, ignored when `server` is provided.
   * Must be a role of `rights` when both are set.
   * @default "default"
   */
  defaultRole?: string;
  /**
   * Authentication provider, ignored when `server` is provided.
   * @default BypassAuthentication
   */
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
  /**
   * Forwarded to the WebSocket transport.
   * @default false
   */
  compression?: boolean | WebsocketCompressionOptions;
}

export function createWebSocketNetworkPlugin(
  options: WebsocketVitePluginOptions
): Plugin {
  const {
    path = DEFAULT_WEBSOCKET_PATH,
    extensions = [],
    rights,
    defaultRole,
    auth,
    compression
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
        server,
        compression
      });
    }
  };
}
