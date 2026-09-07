// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";
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

export function contentTypesFromKinds(
  kinds: AssetKindRegistry
): Record<string, string> {
  const table: Record<string, string> = {
    ...DEFAULT_CONTENT_TYPES
  };

  for (const kind of kinds.kinds()) {
    Object.assign(
      table,
      kinds.get(kind).contentTypes
    );
  }

  return table;
}

export function resolveContentType(
  assetPath: string,
  table: Readonly<Record<string, string>> = DEFAULT_CONTENT_TYPES
): string {
  const extension = path.posix.extname(
    assetPath
  ).toLowerCase();

  return table[extension] ?? DEFAULT_CONTENT_TYPE;
}
