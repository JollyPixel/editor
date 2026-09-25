// Import Third-party Dependencies
import { contentType } from "@openally/servo";

export { DEFAULT_CONTENT_TYPE } from "@openally/servo";

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

export function resolveContentType(
  assetPath: string,
  table: Readonly<Record<string, string>> = DEFAULT_CONTENT_TYPES
): string {
  return contentType(assetPath, table);
}
