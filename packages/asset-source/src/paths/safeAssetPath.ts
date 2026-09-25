// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import {
  safePath,
  type PathRejection
} from "@openally/servo/paths";

// Import Internal Dependencies
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";

export type AssetPathRejection =
  | PathRejection
  | "empty"
  | "directory";

export function safeAssetPath(
  input: string
): Result<string, AssetPathRejection> {
  if (input.length === 0) {
    return Err("empty");
  }

  const result = safePath(input);
  if (!result.ok) {
    return Err(result.reason);
  }
  if (result.directory) {
    return Err("directory");
  }

  return Ok(result.path);
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
