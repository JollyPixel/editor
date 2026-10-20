export class UnknownAssetError extends Error {
  readonly assetId: string;

  constructor(
    assetId: string
  ) {
    super(`Unknown asset "${assetId}".`);
    this.name = "UnknownAssetError";
    this.assetId = assetId;
  }
}
