/**
 * Reports reuse of one asset kind through a different AssetType token.
 */
export class AssetTypeMismatchError extends Error {
  constructor(
    kind: string
  ) {
    super(`Asset kind "${kind}" uses a different AssetType token.`);
    this.name = "AssetTypeMismatchError";
  }
}
