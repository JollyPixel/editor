// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";

/**
 * Normalizes a source-relative path and rejects root escapes.
 */
export function normalizeAssetPath(
  input: string
): string {
  if (input.length === 0) {
    throw new AssetPathEscapeError(input);
  }

  const posix = input.replaceAll("\\", "/");
  if (path.posix.isAbsolute(posix) || /^[a-zA-Z]:/.test(posix)) {
    throw new AssetPathEscapeError(input);
  }

  const normalized = path.posix.normalize(posix);
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized === "." ||
    normalized.endsWith("/")
  ) {
    throw new AssetPathEscapeError(input);
  }

  return normalized;
}

/**
 * Converts an absolute filesystem path to a root-relative POSIX path,
 * or `null` when it lies outside the root.
 */
export function toRelativePosix(
  root: string,
  absolute: string
): string | null {
  const relative = path.relative(root, absolute);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }

  return relative.replaceAll("\\", "/");
}
