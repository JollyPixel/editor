// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";

/**
 * Announced for an extension no kind and no table claims.
 */
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * Extensions a workspace can hold whatever kinds are registered.
 */
export const DEFAULT_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml"
};

/**
 * Merges the content types registered kinds declare over the defaults, in
 * registration order. Later kinds win an extension two of them claim.
 */
export function contentTypesFromKinds(
  kinds: AssetKindRegistry
): Record<string, string> {
  const table: Record<string, string> = { ...DEFAULT_CONTENT_TYPES };

  for (const kind of kinds.kinds()) {
    Object.assign(table, kinds.get(kind).contentTypes);
  }

  return table;
}

/**
 * Content type for a path, matched on its lowercased extension.
 */
export function resolveContentType(
  assetPath: string,
  table: Readonly<Record<string, string>> = DEFAULT_CONTENT_TYPES
): string {
  const extension = path.posix.extname(assetPath).toLowerCase();

  return table[extension] ?? DEFAULT_CONTENT_TYPE;
}
