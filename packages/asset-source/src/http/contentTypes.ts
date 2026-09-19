// Import Node.js Dependencies
import path from "node:path";

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

export function resolveContentType(
  assetPath: string,
  table: Readonly<Record<string, string>> = DEFAULT_CONTENT_TYPES
): string {
  const name = path.posix.basename(assetPath).toLowerCase();

  let longest: string | null = null;
  for (const extension of Object.keys(table)) {
    if (
      name.length > extension.length &&
      name.endsWith(extension) &&
      (longest === null || extension.length > longest.length)
    ) {
      longest = extension;
    }
  }

  return longest === null ? DEFAULT_CONTENT_TYPE : table[longest];
}
