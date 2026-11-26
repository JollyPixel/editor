// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";
import {
  allowMethods,
  sendPayload,
  splitTarget
} from "@openally/servo";

// Import Internal Dependencies
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";

// CONSTANTS
const kJsonContentType = "application/json; charset=utf-8";

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

interface CatalogBody {
  readonly revision: number;
  readonly bytes: Uint8Array;
}

export function createCatalogHandler(
  options: CatalogHandlerOptions
): CatalogHandler {
  const {
    projection,
    path = CATALOG_URL_PATH
  } = options;
  let body: CatalogBody | null = null;

  function currentBody(): CatalogBody {
    if (body?.revision !== projection.revision) {
      body = {
        revision: projection.revision,
        bytes: Buffer.from(JSON.stringify(projection.snapshot()))
      };
    }

    return body;
  }

  return function catalogHandler(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) {
    if (splitTarget(request.url ?? "/").path !== path) {
      next();

      return;
    }

    if (!allowMethods(request, response)) {
      return;
    }

    sendPayload(request, response, {
      body: currentBody().bytes,
      contentType: kJsonContentType,
      cacheControl: "no-cache",
      etag: true
    }).catch(() => response.destroy());
  };
}
