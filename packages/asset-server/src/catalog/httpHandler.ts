// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Internal Dependencies
import type { CatalogProjection } from "./CatalogProjection.ts";

export const DEFAULT_CATALOG_PATH = "/__jollypixel/catalog";

export type CatalogHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface CatalogHandlerOptions {
  projection: CatalogProjection;
  /**
   * @default DEFAULT_CATALOG_PATH
   */
  path?: string;
}

export function createCatalogHandler(
  options: CatalogHandlerOptions
): CatalogHandler {
  const {
    projection,
    path = DEFAULT_CATALOG_PATH
  } = options;

  return function catalogHandler(request, response, next) {
    const requestUrl = URL.parse(
      request.url ?? "",
      "http://localhost"
    );
    if (requestUrl?.pathname !== path) {
      next();

      return;
    }

    if (
      request.method !== "GET" &&
      request.method !== "HEAD"
    ) {
      response.statusCode = 405;
      response.setHeader("allow", "GET, HEAD");
      response.end();

      return;
    }

    const payload = JSON.stringify(
      projection.snapshot()
    );

    response.statusCode = 200;
    response.setHeader(
      "content-type",
      "application/json; charset=utf-8"
    );
    response.setHeader(
      "content-length",
      String(Buffer.byteLength(payload))
    );
    response.end(
      request.method === "HEAD" ? undefined : payload
    );
  };
}
