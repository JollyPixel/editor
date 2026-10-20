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
  type AssetCatalog
} from "@jolly-pixel/asset";
import { DEFAULT_WEBSOCKET_PATH } from "@jolly-pixel/network";
import {
  WebsocketTransport,
  type WebsocketCompressionOptions
} from "@jolly-pixel/network/node";

// Import Internal Dependencies
import { createCatalogHandler } from "../catalogHandler.ts";
import type { CatalogProjection } from "../../catalog/CatalogProjection.ts";
import {
  LAUNCH_ELEMENT_ID,
  serializeLaunch
} from "../../launch.ts";
import {
  AssetServer,
  type AssetServerOptions
} from "../AssetServer.ts";

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

export interface AssetServerPluginOptions extends AssetServerOptions {
  /**
   * Serves the catalog JSON at `catalogPath` and the asset files under
   * `prefix`. Neither route authenticates the request.
   * @default true
   */
  http?: boolean;
  /**
   * @default CATALOG_URL_PATH
   */
  catalogPath?: string;
  /**
   * URL prefix the asset files are served under.
   * @default ASSET_URL_PREFIX
   */
  prefix?: string;
  /**
   * WebSocket upgrade path, kept separate from Vite HMR.
   * @default DEFAULT_WEBSOCKET_PATH
   */
  socketPath?: string;
  /**
   * Negotiates permessage-deflate on the WebSocket.
   * @default false
   */
  compression?: boolean | WebsocketCompressionOptions;
  /**
   * Called once the back-end is up, for a host needing its handles.
   */
  onReady?: (
    server: AssetServer
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

export function createAssetServerPlugin(
  options: AssetServerPluginOptions
): Plugin {
  const {
    http = true,
    catalogPath = CATALOG_URL_PATH,
    prefix,
    socketPath = DEFAULT_WEBSOCKET_PATH,
    compression,
    onReady,
    launch,
    ...serverOptions
  } = options;

  let assetServer: AssetServer | null = null;

  return {
    name: "asset-server",
    apply: "serve",
    async configureServer(devServer) {
      assetServer = await AssetServer.open(serverOptions);

      if (http) {
        devServer.middlewares.use(
          createCatalogHandler({
            projection: assetServer.backend.catalog,
            path: catalogPath
          })
        );
        devServer.middlewares.use(
          createAssetStaticHandler({
            source: assetServer.source,
            contentTypes: assetServer.backend.kinds.contentTypes(),
            prefix
          })
        );
      }

      if (devServer.httpServer) {
        new WebsocketTransport({
          path: socketPath,
          httpServer: devServer.httpServer,
          server: assetServer.network,
          compression,
          allowedHosts: devServer.config.server.allowedHosts
        });
      }

      await onReady?.(assetServer);
    },
    transformIndexHtml(_html, context) {
      if (launch === undefined || assetServer === null) {
        return [];
      }

      const target = launch({
        url: requestUrl(context),
        catalog: assetServer.backend.catalog.catalog
      });

      return target === undefined ? [] : [launchTag(target)];
    },
    async closeBundle() {
      await assetServer?.close();
      assetServer = null;
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
  return {
    tag: "script",
    attrs: {
      type: "application/json",
      id: LAUNCH_ELEMENT_ID
    },
    children: serializeLaunch({ target }),
    injectTo: "head"
  };
}
