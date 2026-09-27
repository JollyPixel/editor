/**
 * Reports reuse of one asset kind through a different AssetType token.
 */
export class AssetTypeMismatchError extends Error {
  readonly kind: string;

  constructor(
    kind: string
  ) {
    super(`Asset kind "${kind}" uses a different AssetType token.`);
    this.name = "AssetTypeMismatchError";
    this.kind = kind;
  }
}
