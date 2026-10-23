// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetSource } from "../AssetSource.ts";
import { AssetPathEscapeError } from "../errors/AssetPathEscapeError.ts";
import { safeAssetPath } from "./safeAssetPath.ts";
import { isStatePath } from "./statePath.ts";

export function writableAssetPath(
  source: Pick<AssetSource, "isIgnored">,
  input: string
): Result<string, AssetPathEscapeError> {
  const result = safeAssetPath(input);
  if (!result.ok) {
    const error = new AssetPathEscapeError(input, result.val);

    return Err(error);
  }
  if (isReservedPath(source, result.val)) {
    const error = new AssetPathEscapeError(input, "reserved");

    return Err(error);
  }

  return Ok(result.val);
}

export function isReservedPath(
  source: Pick<AssetSource, "isIgnored">,
  assetPath: string
): boolean {
  return isStatePath(assetPath) || source.isIgnored(assetPath);
}
