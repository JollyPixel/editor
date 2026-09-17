// Import Third-party Dependencies
import type { Plugin } from "vite";
import {
  createAssetStaticHandler,
  type AssetStaticHandlerOptions
} from "@jolly-pixel/asset-source";
import { WebsocketTransport } from "@jolly-pixel/network/transport/websocket.ts";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network/transport/constants.ts";

// Import Internal Dependencies
import {
  createCatalogHandler,
  DEFAULT_CATALOG_PATH
} from "../catalog/httpHandler.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import {
  createAssetWorkspace,
  type AssetWorkspace,
  type AssetWorkspaceOptions
} from "../workspace/createAssetWorkspace.ts";

export interface AssetCatalogPluginOptions {
  projection: CatalogProjection;
  /**
   * @default DEFAULT_CATALOG_PATH
   */
  path?: string;
}

export function createAssetCatalogPlugin(
  options: AssetCatalogPluginOptions
): Plugin {
  const {
    projection,
    path = DEFAULT_CATALOG_PATH
  } = options;

  return {
    name: "asset-server-catalog",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        createCatalogHandler({
          projection,
          path
        })
      );
    }
  };
}

export function createAssetStaticPlugin(
  options: AssetStaticHandlerOptions
): Plugin {
  return {
    name: "asset-server-static",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        createAssetStaticHandler(options)
      );
    }
  };
}

export interface AssetWorkspacePluginOptions extends AssetWorkspaceOptions {
  /**
   * @default DEFAULT_CATALOG_PATH
   */
  catalogPath?: string;
  /**
   * URL prefix the workspace is served under.
   * @default ASSET_URL_PREFIX
   */
  prefix?: string;
  /**
   * WebSocket upgrade path, kept separate from Vite HMR.
   * @default DEFAULT_WEBSOCKET_PATH
   */
  socketPath?: string;
  /**
   * Called once the back-end is up, for a host needing its handles.
   */
  onReady?: (
    workspace: AssetWorkspace
  ) => void | Promise<void>;
}

export function createAssetWorkspacePlugin(
  options: AssetWorkspacePluginOptions
): Plugin {
  const {
    catalogPath = DEFAULT_CATALOG_PATH,
    prefix,
    socketPath = DEFAULT_WEBSOCKET_PATH,
    onReady,
    ...workspaceOptions
  } = options;

  let workspace: AssetWorkspace | null = null;

  return {
    name: "asset-server-workspace",
    apply: "serve",
    async configureServer(devServer) {
      workspace = await createAssetWorkspace(workspaceOptions);

      devServer.middlewares.use(
        createCatalogHandler({
          projection: workspace.backend.catalog,
          path: catalogPath
        })
      );
      devServer.middlewares.use(
        createAssetStaticHandler({
          source: workspace.source,
          contentTypes: workspace.backend.kinds.contentTypes(),
          prefix
        })
      );

      if (devServer.httpServer) {
        new WebsocketTransport({
          path: socketPath,
          httpServer: devServer.httpServer,
          server: workspace.server
        });
      }

      await onReady?.(workspace);
    },
    async closeBundle() {
      await workspace?.close();
      workspace = null;
    }
  };
}
