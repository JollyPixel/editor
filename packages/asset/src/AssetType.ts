// CONSTANTS
// Keeps TValue in the structural type without adding runtime state.
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
    if (kind.trim().length === 0) {
      throw new TypeError("Asset type kind must not be empty.");
    }

    this.kind = kind;
  }
}
