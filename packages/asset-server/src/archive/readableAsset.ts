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
import { asError } from "../utils/asError.ts";

/**
 * Loads the asset into a throwaway state of its kind, so export and import
 * accept exactly the same documents.
 */
export function readableAsset(
  kinds: AssetKindRegistry,
  asset: AssetArchiveAsset
): Result<void, AssetImportError> {
  if (!kinds.has(asset.kind)) {
    const error = new UnknownAssetKindError(asset.kind);

    return Err(error);
  }

  const handler = kinds.get(asset.kind);
  try {
    handler.load(handler.create(asset.id), asset.data);
  }
  catch (cause) {
    const error = new AssetArchiveError(
      "unreadable-asset",
      `Asset "${asset.path}" is not a readable "${asset.kind}": ` +
      `${asError(cause).message}`,
      {
        assetId: asset.id,
        cause
      }
    );

    return Err(error);
  }

  return Ok(undefined);
}
