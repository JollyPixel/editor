export class AssetPathConflictError extends Error {
  readonly path: string;
  readonly assetId: string;

  constructor(
    path: string,
    assetId: string
  ) {
    super(`Path "${path}" is already used by asset "${assetId}".`);
    this.name = "AssetPathConflictError";
    this.path = path;
    this.assetId = assetId;
  }
}
