// Import Internal Dependencies
import type { AssetKind } from "../AssetKind.ts";

export class AssetTypeMismatchError extends Error {
  readonly kind: AssetKind;

  constructor(
    kind: AssetKind
  ) {
    super(`Asset kind "${kind}" uses a different AssetType token.`);
    this.name = "AssetTypeMismatchError";
    this.kind = kind;
  }
}
