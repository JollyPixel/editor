// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetArchiveAsset } from "./AssetArchive.ts";
import type { AssetImportError } from "./import/AssetImport.ts";
import { AssetArchiveError } from "./errors/AssetArchiveError.ts";
import { UnknownAssetKindError } from "../kinds/errors/UnknownAssetKindError.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";

/**
 * Loads the asset into a throwaway state of its kind, so export and import
 * accept exactly the same documents.
 */
export function readableAsset(
  kinds: AssetKindRegistry,
  asset: AssetArchiveAsset
): Result<void, AssetImportError> {
  const decoded = kinds.decode(asset.kind, asset.id, asset.data);
  if (decoded.ok) {
    return Ok(undefined);
  }
  if (decoded.val instanceof UnknownAssetKindError) {
    return Err(decoded.val);
  }

  const error = new AssetArchiveError(
    "unreadable-asset",
    `Asset "${asset.path}" is not a readable "${asset.kind}": ` +
    `${decoded.val.message}`,
    {
      assetId: asset.id,
      cause: decoded.val
    }
  );

  return Err(error);
}
