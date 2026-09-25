// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";
import {
  allowMethods,
  sendJson
} from "@openally/servo";

// Import Internal Dependencies
import type { CatalogProjection } from "./CatalogProjection.ts";

export type CatalogHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface CatalogHandlerOptions {
  projection: CatalogProjection;
  /**
   * @default CATALOG_URL_PATH
   */
  path?: string;
}

export function createCatalogHandler(
  options: CatalogHandlerOptions
): CatalogHandler {
  const {
    projection,
    path = CATALOG_URL_PATH
  } = options;

  return function catalogHandler(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) {
    const requestUrl = URL.parse(
      request.url ?? "",
      "http://localhost"
    );
    if (requestUrl?.pathname !== path) {
      next();

      return;
    }

    if (!allowMethods(request, response)) {
      return;
    }

    sendJson(request, response, {
      body: projection.snapshot(),
      cacheControl: "no-cache",
      etag: true
    }).catch(() => {
      response.destroy();
    });
  };
}
