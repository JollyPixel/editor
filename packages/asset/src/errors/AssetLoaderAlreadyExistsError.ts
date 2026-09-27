/**
 * Reports an attempt to register a second loader for the same asset kind.
 */
export class AssetLoaderAlreadyExistsError extends Error {
  readonly kind: string;

  constructor(
    kind: string
  ) {
    super(`A loader for asset kind "${kind}" is already registered.`);
    this.name = "AssetLoaderAlreadyExistsError";
    this.kind = kind;
  }
}
