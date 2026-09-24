export class InvalidAssetNameError extends Error {
  readonly assetName: string;

  constructor(
    assetName: string,
    reason: string
  ) {
    super(`"${assetName}" is not a valid name: ${reason}.`);
    this.name = "InvalidAssetNameError";
    this.assetName = assetName;
  }
}
