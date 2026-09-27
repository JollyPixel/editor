// Import Internal Dependencies
import type { AssetId } from "../AssetId.ts";

/**
 * Reports an attempt to insert the same stable asset ID twice.
 */
export class AssetAlreadyExistsError extends Error {
  readonly id: AssetId;

  constructor(
    id: AssetId
  ) {
    super(`Asset "${id}" already exists in the catalog.`);
    this.name = "AssetAlreadyExistsError";
    this.id = id;
  }
}
