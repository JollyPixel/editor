// Import Internal Dependencies
import type { AssetKind } from "../AssetKind.ts";

export class AssetLoaderNotFoundError extends Error {
  readonly kind: AssetKind;

  constructor(
    kind: AssetKind
  ) {
    super(`No loader is registered for asset kind "${kind}".`);
    this.name = "AssetLoaderNotFoundError";
    this.kind = kind;
  }
}
