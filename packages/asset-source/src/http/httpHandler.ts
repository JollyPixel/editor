// Import Node.js Dependencies
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

// Import Third-party Dependencies
import { ASSET_URL_PREFIX } from "@jolly-pixel/asset";
import {
  bytesSource,
  servo
} from "@openally/servo";

// Import Internal Dependencies
import type { AssetSource } from "../AssetSource.ts";
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";
import { isStatePath } from "../paths/index.ts";
import {
  DEFAULT_CONTENT_TYPES,
  resolveContentType
} from "./contentTypes.ts";

// CONSTANTS
const kMissingCodes = new Set([
  "ENOENT",
  "EISDIR",
  "ENOTDIR"
]);

export type AssetStaticHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void
) => void;

export interface AssetStaticHandlerOptions {
  source: AssetSource;
  /**
   * URL prefix the workspace is mounted under. `/assets` and `/assets/`
   * behave the same.
   * @default ASSET_URL_PREFIX
   */
  prefix?: string;
  /**
   * Extension-to-content-type entries merged over `DEFAULT_CONTENT_TYPES`.
   */
  contentTypes?: Readonly<Record<string, string>>;
}

export function createAssetStaticHandler(
  options: AssetStaticHandlerOptions
): AssetStaticHandler {
  const {
    source,
    prefix = ASSET_URL_PREFIX,
    contentTypes
  } = options;

  const table = {
    ...DEFAULT_CONTENT_TYPES,
    ...contentTypes
  };

  return servo(
    bytesSource(
      (assetPath) => readAsset(source, assetPath),
      { etag: "content" }
    ),
    {
      prefix,
      methodNotAllowed: "reject",
      dev: true,
      index: false,
      extensions: [],
      redirect: false,
      dotfiles: "allow",
      ignore: (assetPath) => isHidden(source, assetPath),
      setHeaders: (response, assetPath) => {
        response.setHeader(
          "Content-Type",
          resolveContentType(assetPath, table)
        );
      },
      onNoMatch: (_request, response) => {
        end(response, 404);
      },
      onError: (error, _request, response) => {
        end(
          response,
          error instanceof AssetPathEscapeError ? 403 : 500
        );
      }
    }
  );
}

async function readAsset(
  source: AssetSource,
  assetPath: string
): Promise<Uint8Array | null> {
  try {
    return await source.read(assetPath);
  }
  catch (error: any) {
    if (kMissingCodes.has(error?.code)) {
      return null;
    }

    throw error;
  }
}

function isHidden(
  source: AssetSource,
  assetPath: string
): boolean {
  return isStatePath(assetPath) ||
    (source.isIgnored?.(assetPath) ?? false);
}

function end(
  response: ServerResponse,
  statusCode: number
): void {
  response.statusCode = statusCode;
  response.end();
}
