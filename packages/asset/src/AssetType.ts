// Import Internal Dependencies
import { AssetKind } from "./AssetKind.ts";

// CONSTANTS
declare const kAssetValueTypeBrand: unique symbol;

export class AssetType<
  TValue = unknown
> {
  readonly kind: AssetKind;

  declare readonly [kAssetValueTypeBrand]: TValue;

  constructor(
    kind: string | AssetKind
  ) {
    this.kind = AssetKind.from(kind);
  }
}
