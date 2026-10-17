// Import Internal Dependencies
import type { AssetId } from "../AssetId.ts";

export class AssetNotFoundError extends Error {
  readonly id: AssetId;

  constructor(
    id: AssetId
  ) {
    super(`Asset "${id}" does not exist in the catalog.`);
    this.name = "AssetNotFoundError";
    this.id = id;
  }
}
