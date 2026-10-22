// Import Internal Dependencies
import type { AssetKind } from "../AssetKind.ts";

export class AssetLoaderAlreadyExistsError extends Error {
  readonly kind: AssetKind;

  constructor(
    kind: AssetKind
  ) {
    super(`A loader for asset kind "${kind}" is already registered.`);
    this.name = "AssetLoaderAlreadyExistsError";
    this.kind = kind;
  }
}
