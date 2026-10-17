// Import Internal Dependencies
import { assertAssetKind } from "./assertAssetKind.ts";

// CONSTANTS
declare const kAssetValueTypeBrand: unique symbol;

export class AssetType<
  TValue = unknown
> {
  readonly kind: string;

  declare readonly [kAssetValueTypeBrand]: TValue;

  constructor(
    kind: string
  ) {
    assertAssetKind(kind);

    this.kind = kind;
  }
}
