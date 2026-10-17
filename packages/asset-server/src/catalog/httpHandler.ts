// Import Node.js Dependencies
import { createHash } from "node:crypto";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { CATALOG_URL_PATH } from "@jolly-pixel/asset";
import {
  allowMethods,
  send,
  type ServoEntry
} from "@openally/servo";

// Import Internal Dependencies
import type { CatalogProjection } from "./CatalogProjection.ts";

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
  readonly bytes: Buffer;
  readonly etag: string;
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
      const bytes = Buffer.from(JSON.stringify(projection.snapshot()));
      body = {
        revision: projection.revision,
        bytes,
        etag: `"${createHash("sha1").update(bytes).digest("base64url")}"`
      };
    }

    return body;
  }

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

    response.setHeader("Cache-Control", "no-cache");
    send(request, response, {
      entry: bytesEntry(currentBody()),
      contentType: kJsonContentType
    }).catch(() => response.destroy());
  };
}

function bytesEntry(
  { bytes, etag }: CatalogBody
): ServoEntry {
  return {
    size: bytes.byteLength,
    etag,
    body: (range) => (range === undefined ?
      bytes :
      bytes.subarray(range.start, range.end + 1)),
    [Symbol.asyncDispose]: () => Promise.resolve()
  };
}
