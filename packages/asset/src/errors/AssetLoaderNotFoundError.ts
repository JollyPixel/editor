/**
 * Reports a load request for an asset kind without a registered loader.
 */
export class AssetLoaderNotFoundError extends Error {
  constructor(
    kind: string
  ) {
    super(`No loader is registered for asset kind "${kind}".`);
    this.name = "AssetLoaderNotFoundError";
  }
}
