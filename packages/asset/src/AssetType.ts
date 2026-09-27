// Import Internal Dependencies
import { assertAssetKind } from "./assertAssetKind.ts";

// CONSTANTS
declare const kAssetValueTypeBrand: unique symbol;

/**
 * Binds a persistent asset kind to the value produced by its loader.
 */
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
