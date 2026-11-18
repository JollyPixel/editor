export class AssetClosedError extends Error {
  constructor(
    assetId: string
  ) {
    super(`Asset "${assetId}" is closed.`);
    this.name = "AssetClosedError";
  }
}
