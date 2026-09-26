// Import Third-party Dependencies
import type {
  HtmlTagDescriptor,
  IndexHtmlTransformContext,
  Plugin
} from "vite";
import {
  createAssetStaticHandler,
  type AssetStaticHandlerOptions
} from "@jolly-pixel/asset-source/node";
import {
  CATALOG_URL_PATH,
  LAUNCH_ELEMENT_ID,
  type AssetCatalog
} from "@jolly-pixel/asset";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import { WebsocketTransport } from "@jolly-pixel/network/node";

// Import Internal Dependencies
import { createCatalogHandler } from "../catalog/httpHandler.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import {
  createAssetWorkspace,
  type AssetWorkspace,
  type AssetWorkspaceOptions
} from "../workspace/createAssetWorkspace.ts";

export interface AssetCatalogPluginOptions {
  projection: CatalogProjection;
  /**
   * @default CATALOG_URL_PATH
   */
  path?: string;
}

export function createAssetCatalogPlugin(
  options: AssetCatalogPluginOptions
): Plugin {
  const {
    projection,
    path = CATALOG_URL_PATH
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
   * @default CATALOG_URL_PATH
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
  /**
   * Picks the asset an HTML page opens. The id is injected as
   * `{ "target": id }` into a `<script type="application/json">` element
   * with id `LAUNCH_ELEMENT_ID`. Nothing is injected for `undefined`.
   */
  launch?: (
    request: AssetLaunchRequest
  ) => string | undefined;
}

export interface AssetLaunchRequest {
  /**
   * Requested page URL, resolved against `http://localhost`.
   */
  readonly url: URL;
  readonly catalog: AssetCatalog;
}

export function createAssetWorkspacePlugin(
  options: AssetWorkspacePluginOptions
): Plugin {
  const {
    catalogPath = CATALOG_URL_PATH,
    prefix,
    socketPath = DEFAULT_WEBSOCKET_PATH,
    onReady,
    launch,
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
    transformIndexHtml(_html, context) {
      if (launch === undefined || workspace === null) {
        return [];
      }

      const target = launch({
        url: requestUrl(context),
        catalog: workspace.backend.catalog.catalog
      });

      return target === undefined ? [] : [launchTag(target)];
    },
    async closeBundle() {
      await workspace?.close();
      workspace = null;
    }
  };
}

function requestUrl(
  context: IndexHtmlTransformContext
): URL {
  return new URL(
    context.originalUrl ?? context.path,
    "http://localhost"
  );
}

function launchTag(
  target: string
): HtmlTagDescriptor {
  const payload = JSON.stringify({ target })
    .replaceAll("<", "\\u003c");

  return {
    tag: "script",
    attrs: {
      type: "application/json",
      id: LAUNCH_ELEMENT_ID
    },
    children: payload,
    injectTo: "head"
  };
}
