/**
 * Reports a kind lookup matching no record in the catalog.
 */
export class AssetKindNotFoundError extends Error {
  readonly kind: string;

  constructor(
    kind: string
  ) {
    super(`The catalog holds no "${kind}" asset.`);
    this.name = "AssetKindNotFoundError";
    this.kind = kind;
  }
}
