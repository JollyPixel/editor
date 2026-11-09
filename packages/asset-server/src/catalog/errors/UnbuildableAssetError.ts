export class UnbuildableAssetError extends Error {
  readonly assetId: string;
  readonly kind: string;

  constructor(
    assetId: string,
    kind: string
  ) {
    super(`Asset "${assetId}" of kind "${kind}" has no game build.`);
    this.name = "UnbuildableAssetError";
    this.assetId = assetId;
    this.kind = kind;
  }
}
