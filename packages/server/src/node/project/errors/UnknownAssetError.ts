export class UnknownAssetError extends Error {
  constructor(
    assetId: string
  ) {
    super(`no asset has the id "${assetId}"`);
    this.name = "UnknownAssetError";
  }
}
