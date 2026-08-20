// Import Third-party Dependencies
import type { Plugin } from "vite";

// Import Internal Dependencies
import {
  createCatalogHandler,
  DEFAULT_CATALOG_PATH
} from "../catalog/httpHandler.ts";
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";

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
