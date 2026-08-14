// Import Internal Dependencies
import type { AssetId } from "../AssetId.ts";

/**
 * Reports a lookup for an asset ID absent from the catalog.
 */
export class AssetNotFoundError extends Error {
  constructor(
    id: AssetId
  ) {
    super(`Asset "${id}" does not exist in the catalog.`);
    this.name = "AssetNotFoundError";
  }
}
