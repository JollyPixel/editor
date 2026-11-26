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
  ".ktx2": "image/ktx2",
  ".svg": "image/svg+xml"
};
