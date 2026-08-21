// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { ASSET_URL_PREFIX } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import { normalizeAssetPath } from "../sources/paths.ts";
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";
import { STATE_DIRECTORY } from "../constants.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import {
  contentTypesFromKinds,
  DEFAULT_CONTENT_TYPES,
  resolveContentType
} from "./contentTypes.ts";

export const DEFAULT_ASSET_PREFIX = ASSET_URL_PREFIX;

export type AssetStaticHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface AssetStaticHandlerOptions {
  source: AssetSource;
  /**
   * URL prefix the workspace is mounted under. A missing trailing slash is
   * added, so `/assets` and `/assets/` behave the same.
   * @default DEFAULT_ASSET_PREFIX
   */
  prefix?: string;
  /**
   * Kinds contributing content types for the extensions they claim.
   */
  kinds?: AssetKindRegistry;
  /**
   * Extension-to-content-type entries taking precedence over the kinds.
   */
  contentTypes?: Readonly<Record<string, string>>;
}

/**
 * Serves the asset workspace under a URL prefix, reading through the source
 * so any implementation is servable.
 *
 * The catalog hands the browser workspace-relative `source` paths, which
 * have to resolve to something.
 */
export function createAssetStaticHandler(
  options: AssetStaticHandlerOptions
): AssetStaticHandler {
  const {
    source,
    kinds,
    contentTypes
  } = options;

  const prefix = withTrailingSlash(options.prefix ?? DEFAULT_ASSET_PREFIX);
  const table = {
    ...kinds ? contentTypesFromKinds(kinds) : DEFAULT_CONTENT_TYPES,
    ...contentTypes
  };

  return function assetStaticHandler(request, response, next) {
    const url = request.url ?? "";
    if (!url.startsWith(prefix)) {
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

    let requested: string;
    try {
      requested = decodeURIComponent(
        url.slice(prefix.length).split("?")[0]
      );
    }
    catch {
      response.statusCode = 400;
      response.end();

      return;
    }

    let assetPath: string;
    try {
      assetPath = normalizeAssetPath(requested);
    }
    catch (error) {
      // A "../" in the request must not escape the workspace.
      if (error instanceof AssetPathEscapeError && looksLikeEscape(requested)) {
        response.statusCode = 403;
      }
      else {
        response.statusCode = 404;
      }
      response.end();

      return;
    }

    if (isStatePath(assetPath)) {
      response.statusCode = 404;
      response.end();

      return;
    }

    void serve(
      source,
      assetPath,
      resolveContentType(assetPath, table),
      request,
      response
    );
  };
}

async function serve(
  source: AssetSource,
  assetPath: string,
  contentType: string,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  let bytes: Uint8Array;
  try {
    bytes = await source.read(assetPath);
  }
  catch (error) {
    response.statusCode = isNotFound(error) ? 404 : 500;
    response.end();

    return;
  }

  response.statusCode = 200;
  response.setHeader("content-type", contentType);
  response.setHeader("content-length", String(bytes.byteLength));
  response.end(
    request.method === "HEAD" ? undefined : Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    )
  );
}

/**
 * Tells a rejected traversal from a merely unservable path, such as the
 * prefix itself or a trailing slash.
 */
function looksLikeEscape(
  requested: string
): boolean {
  return requested.startsWith("/") ||
    /^[a-zA-Z]:/.test(requested) ||
    requested.replaceAll("\\", "/").split("/").includes("..");
}

/**
 * The state directory is back-end bookkeeping and never served.
 */
function isStatePath(
  assetPath: string
): boolean {
  return assetPath === STATE_DIRECTORY ||
    assetPath.startsWith(`${STATE_DIRECTORY}/`);
}

function isNotFound(
  error: unknown
): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}

function withTrailingSlash(
  prefix: string
): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}
