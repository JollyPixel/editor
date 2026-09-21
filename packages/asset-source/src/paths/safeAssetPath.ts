// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";
import { normalizePosix } from "./normalizePosix.ts";

// CONSTANTS
// eslint-disable-next-line no-control-regex
const kControlCharacters = /[\u0000-\u001F\u007F]/;
const kWindowsDrive = /^[a-zA-Z]:/;

export type AssetPathRejection =
  | "empty"
  | "invalid"
  | "absolute"
  | "traversal"
  | "directory"
  | "reserved";

export function safeAssetPath(
  input: string
): Result<string, AssetPathRejection> {
  if (input.length === 0) {
    return Err("empty");
  }
  if (kControlCharacters.test(input)) {
    return Err("invalid");
  }

  const posix = input.replaceAll("\\", "/");
  if (
    posix.startsWith("/") ||
    kWindowsDrive.test(posix)
  ) {
    return Err("absolute");
  }

  const normalized = normalizePosix(posix);
  if (
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return Err("traversal");
  }
  if (
    normalized === "." ||
    normalized.endsWith("/")
  ) {
    return Err("directory");
  }

  return Ok(normalized);
}

export function normalizeAssetPath(
  input: string
): string {
  const result = safeAssetPath(input);
  if (!result.ok) {
    throw new AssetPathEscapeError(input, result.val);
  }

  return result.val;
}
