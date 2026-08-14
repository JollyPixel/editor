// Import Internal Dependencies
import type { AssetId } from "../AssetId.ts";

/**
 * Reports disagreement between a reference kind and its catalog record.
 */
export class AssetKindMismatchError extends Error {
  constructor(
    id: AssetId,
    expectedKind: string,
    actualKind: string
  ) {
    super(
      `Asset "${id}" has kind "${actualKind}" but ` +
      `"${expectedKind}" was requested.`
    );
    this.name = "AssetKindMismatchError";
  }
}
