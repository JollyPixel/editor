export class UnknownAssetError extends Error {
  readonly assetId: string;

  constructor(
    assetId: string
  ) {
    super(`The catalog has no asset "${assetId}".`);
    this.name = "UnknownAssetError";
    this.assetId = assetId;
  }
}
