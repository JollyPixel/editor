// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { ASSET_URL_PREFIX } from "@jolly-pixel/asset";
import {
  AssetPathEscapeError,
  isStatePath,
  safeAssetPath,
  type AssetPathRejection,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import {
  contentTypesFromKinds,
  DEFAULT_CONTENT_TYPES,
  resolveContentType
} from "./contentTypes.ts";

// CONSTANTS
const kRejectionStatus: Readonly<Record<AssetPathRejection, number>> = {
  empty: 404,
  directory: 404,
  invalid: 400,
  absolute: 403,
  traversal: 403,
  reserved: 403
};

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

export function createAssetStaticHandler(
  options: AssetStaticHandlerOptions
): AssetStaticHandler {
  const {
    source,
    kinds,
    contentTypes
  } = options;

  const prefix = withTrailingSlash(
    options.prefix ?? DEFAULT_ASSET_PREFIX
  );
  const table = {
    ...kinds ? contentTypesFromKinds(kinds) : DEFAULT_CONTENT_TYPES,
    ...contentTypes
  };

  return function assetStaticHandler(
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) {
    const target = request.url ?? "";
    if (!target.startsWith(prefix)) {
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

    const requested = decodeRequestPath(
      target.slice(prefix.length)
    );
    if (requested === null) {
      end(response, 400);

      return;
    }

    const resolved = safeAssetPath(requested);
    if (!resolved.ok) {
      end(response, kRejectionStatus[resolved.val]);

      return;
    }

    const assetPath = resolved.val;
    if (isHidden(source, assetPath)) {
      end(response, 404);

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
    if (error instanceof AssetPathEscapeError) {
      end(response, 403);

      return;
    }

    end(
      response,
      isMissing(error) ? 404 : 500
    );

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

function decodeRequestPath(
  target: string
): string | null {
  const separator = target.search(/[?#]/);
  const encoded = separator === -1 ?
    target :
    target.slice(0, separator);

  try {
    return decodeURIComponent(encoded);
  }
  catch {
    return null;
  }
}

function isHidden(
  source: AssetSource,
  assetPath: string
): boolean {
  return isStatePath(assetPath) ||
    (source.isIgnored?.(assetPath) ?? false);
}

function isMissing(
  error: unknown
): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (
      error.code === "ENOENT" ||
      error.code === "EISDIR" ||
      error.code === "ENOTDIR"
    );
}

function end(
  response: ServerResponse,
  statusCode: number
): void {
  response.statusCode = statusCode;
  response.end();
}

function withTrailingSlash(
  prefix: string
): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}
