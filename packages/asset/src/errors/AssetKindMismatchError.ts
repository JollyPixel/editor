// Import Internal Dependencies
import type { AssetId } from "../AssetId.ts";
import type { AssetKind } from "../AssetKind.ts";

export class AssetKindMismatchError extends Error {
  readonly id: AssetId;
  readonly expectedKind: AssetKind;
  readonly actualKind: AssetKind;

  constructor(
    id: AssetId,
    expectedKind: AssetKind,
    actualKind: AssetKind
  ) {
    super(
      `Asset "${id}" has kind "${actualKind}" but ` +
      `"${expectedKind}" was requested.`
    );
    this.name = "AssetKindMismatchError";
    this.id = id;
    this.expectedKind = expectedKind;
    this.actualKind = actualKind;
  }
}
