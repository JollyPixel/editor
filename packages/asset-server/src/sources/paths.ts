// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import { AssetPathEscapeError } from "./errors/AssetPathEscapeError.ts";
import { STATE_DIRECTORY } from "../constants.ts";

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
    path.posix.isAbsolute(posix) ||
    kWindowsDrive.test(posix)
  ) {
    return Err("absolute");
  }

  const normalized = path.posix.normalize(posix);
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

export function isStatePath(
  assetPath: string
): boolean {
  const lowered = assetPath.toLowerCase();

  return lowered === STATE_DIRECTORY ||
    lowered.startsWith(`${STATE_DIRECTORY}/`);
}

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
